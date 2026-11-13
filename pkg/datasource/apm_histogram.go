package datasource

import (
	"math"
	"sort"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
)

// apmBucket is one histogram bucket (lower, upper] holding count measurements.
type apmBucket struct {
	lower float64
	upper float64
	count float64
}

// apmHist is the bucket layout of one histogram data point: either explicit
// bounds (OTel Histogram) or base-2 exponential buckets (OTel ExponentialHistogram).
type apmHist struct {
	exponential bool
	count       float64
	sum         float64

	// Explicit: len(counts) == len(bounds)+1, the last bucket is (bounds[n-1], +Inf)
	bounds []float64
	counts []float64

	// Exponential: bucket index i covers (base^i, base^(i+1)], base = 2^(2^-scale)
	scale    int
	zero     float64
	positive map[int]float64
	negative map[int]float64
}

func apmHistFromPoint(p *zabbix.APMMetricPoint) apmHist {
	h := apmHist{count: p.Count, sum: p.Sum}
	if p.Type == zabbix.APMMetricTypeExponentialHistogram {
		h.exponential = true
		h.scale = p.Scale
		h.zero = p.ZeroCount
		h.positive = make(map[int]float64, len(p.PositiveBucketCounts))
		for i, c := range p.PositiveBucketCounts {
			if c != 0 {
				h.positive[p.PositiveOffset+i] = c
			}
		}
		h.negative = make(map[int]float64, len(p.NegativeBucketCounts))
		for i, c := range p.NegativeBucketCounts {
			if c != 0 {
				h.negative[p.NegativeOffset+i] = c
			}
		}
		return h
	}

	h.bounds = p.ExplicitBounds
	h.counts = p.BucketCounts
	return h
}

// downscale merges exponential buckets to a lower (coarser) scale.
func (h apmHist) downscale(scale int) apmHist {
	if !h.exponential || scale >= h.scale {
		return h
	}
	shift := uint(h.scale - scale)
	merge := func(src map[int]float64) map[int]float64 {
		dst := make(map[int]float64, len(src))
		for idx, c := range src {
			// Arithmetic shift: floor division, also for negative indexes
			dst[idx>>shift] += c
		}
		return dst
	}
	h.positive = merge(h.positive)
	h.negative = merge(h.negative)
	h.scale = scale
	return h
}

// sub returns the measurements recorded between prev and h, two consecutive
// cumulative data points of one series. ok is false when h cannot be a
// continuation of prev (counter reset or a changed bucket layout).
func (h apmHist) sub(prev apmHist) (delta apmHist, ok bool) {
	if h.exponential != prev.exponential || h.count < prev.count {
		return h, false
	}

	delta = apmHist{exponential: h.exponential, count: h.count - prev.count, sum: h.sum - prev.sum}

	if !h.exponential {
		if len(h.bounds) != len(prev.bounds) || len(h.counts) != len(prev.counts) {
			return h, false
		}
		for i := range h.bounds {
			if h.bounds[i] != prev.bounds[i] {
				return h, false
			}
		}
		delta.bounds = h.bounds
		delta.counts = make([]float64, len(h.counts))
		for i := range h.counts {
			d := h.counts[i] - prev.counts[i]
			if d < 0 {
				return h, false
			}
			delta.counts[i] = d
		}
		return delta, true
	}

	scale := h.scale
	if prev.scale < scale {
		scale = prev.scale
	}
	cur, old := h.downscale(scale), prev.downscale(scale)

	subBuckets := func(a, b map[int]float64) (map[int]float64, bool) {
		out := make(map[int]float64, len(a))
		for idx, c := range a {
			d := c - b[idx]
			if d < 0 {
				return nil, false
			}
			if d > 0 {
				out[idx] = d
			}
		}
		for idx, c := range b {
			if _, exists := a[idx]; !exists && c > 0 {
				return nil, false
			}
		}
		return out, true
	}

	delta.scale = scale
	delta.zero = cur.zero - old.zero
	if delta.zero < 0 {
		return h, false
	}
	if delta.positive, ok = subBuckets(cur.positive, old.positive); !ok {
		return h, false
	}
	if delta.negative, ok = subBuckets(cur.negative, old.negative); !ok {
		return h, false
	}
	return delta, true
}

// buckets returns the non-empty layout as a list sorted by upper bound.
// Explicit histograms keep their empty buckets, so that every bound is known.
func (h apmHist) buckets() []apmBucket {
	if !h.exponential {
		buckets := make([]apmBucket, 0, len(h.counts))
		for i, c := range h.counts {
			lower := math.Inf(-1)
			if i > 0 && i-1 < len(h.bounds) {
				lower = h.bounds[i-1]
			}
			upper := math.Inf(1)
			if i < len(h.bounds) {
				upper = h.bounds[i]
			}
			buckets = append(buckets, apmBucket{lower: lower, upper: upper, count: c})
		}
		return buckets
	}

	base := math.Pow(2, math.Pow(2, float64(-h.scale)))
	buckets := make([]apmBucket, 0, len(h.positive)+len(h.negative)+1)
	for idx, c := range h.negative {
		buckets = append(buckets, apmBucket{
			lower: -math.Pow(base, float64(idx+1)),
			upper: -math.Pow(base, float64(idx)),
			count: c,
		})
	}
	if h.zero > 0 {
		buckets = append(buckets, apmBucket{lower: 0, upper: 0, count: h.zero})
	}
	for idx, c := range h.positive {
		buckets = append(buckets, apmBucket{
			lower: math.Pow(base, float64(idx)),
			upper: math.Pow(base, float64(idx+1)),
			count: c,
		})
	}
	sortAPMBuckets(buckets)
	return buckets
}

func sortAPMBuckets(buckets []apmBucket) {
	sort.Slice(buckets, func(i, j int) bool {
		return buckets[i].upper < buckets[j].upper
	})
}

// mergeAPMBuckets adds the buckets of src, each count multiplied by weight, to dst.
// Buckets are matched by their upper bound. The result is sorted by upper bound.
func mergeAPMBuckets(dst []apmBucket, src []apmBucket, weight float64) []apmBucket {
	index := make(map[float64]int, len(dst))
	for i, b := range dst {
		index[b.upper] = i
	}
	for _, b := range src {
		if i, ok := index[b.upper]; ok {
			dst[i].count += b.count * weight
			continue
		}
		index[b.upper] = len(dst)
		dst = append(dst, apmBucket{lower: b.lower, upper: b.upper, count: b.count * weight})
	}
	sortAPMBuckets(dst)
	return dst
}

// apmHistogramQuantile estimates the q-quantile (0..1) from buckets sorted by upper
// bound, interpolating linearly inside the bucket the quantile falls into, the way
// Prometheus histogram_quantile() does. It returns nil when there are no measurements.
func apmHistogramQuantile(q float64, buckets []apmBucket) *float64 {
	total := 0.0
	for _, b := range buckets {
		total += b.count
	}
	if total <= 0 || math.IsNaN(q) {
		return nil
	}
	if q < 0 {
		q = 0
	}
	if q > 1 {
		q = 1
	}

	rank := q * total
	cumulative := 0.0
	for _, b := range buckets {
		if b.count <= 0 {
			continue
		}
		if cumulative+b.count < rank {
			cumulative += b.count
			continue
		}

		lower, upper := b.lower, b.upper
		var value float64
		switch {
		case math.IsInf(upper, 1):
			// Overflow bucket: the best estimate is the highest finite bound
			value = lower
			if math.IsInf(lower, -1) {
				return nil
			}
		case math.IsInf(lower, -1) && upper <= 0:
			value = upper
		default:
			if math.IsInf(lower, -1) {
				// First bucket of a histogram of non-negative measurements
				lower = 0
			}
			value = lower + (upper-lower)*(rank-cumulative)/b.count
		}
		return &value
	}
	return nil
}
