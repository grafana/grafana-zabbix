package zabbix

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/dlclark/regexp2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (item *Item) ExpandItemName() string {
	name := item.Name
	key := item.Key

	if !strings.Contains(key, "[") {
		return name
	}

	keyParamsStr := key[strings.Index(key, "[")+1 : strings.LastIndex(key, "]")]
	keyParams := splitKeyParams(keyParamsStr)

	for i := len(keyParams); i >= 1; i-- {
		name = strings.ReplaceAll(name, fmt.Sprintf("$%v", i), keyParams[i-1])
	}

	return name
}

func expandItems(items []*Item) []*Item {
	for i := 0; i < len(items); i++ {
		items[i].Name = items[i].ExpandItemName()
	}
	return items
}

func splitKeyParams(paramStr string) []string {
	params := []string{}
	quoted := false
	inArray := false
	splitSymbol := ","
	param := ""

	for _, r := range paramStr {
		symbol := string(r)
		if symbol == `"` && inArray {
			param += symbol
		} else if symbol == `"` && quoted {
			quoted = false
		} else if symbol == `"` && !quoted {
			quoted = true
		} else if symbol == "[" && !quoted {
			inArray = true
		} else if symbol == "]" && !quoted {
			inArray = false
		} else if symbol == splitSymbol && !quoted && !inArray {
			params = append(params, param)
			param = ""
		} else {
			param += symbol
		}
	}

	params = append(params, param)
	return params
}


// safeRegexpCompile compiles a regex with timeout protection
func safeRegexpCompile(pattern string) (*regexp2.Regexp, error) {
	// Channel to receive compilation result
	resultCh := make(chan struct {
		regex *regexp2.Regexp
		err   error
	}, 1)
	
	// Compile regex in goroutine with timeout
	go func() {
		regex, err := regexp2.Compile(pattern, regexp2.RE2)
		resultCh <- struct {
			regex *regexp2.Regexp
			err   error
		}{regex, err}
	}()
	
	// Wait for compilation or timeout
	select {
	case result := <-resultCh:
		return result.regex, result.err
	case <-time.After(5 * time.Second):
		return nil, fmt.Errorf("regex compilation timeout (5s) - pattern may be too complex")
	}
}

func parseFilter(filter string) (*regexp2.Regexp, error) {
	vaildREModifiers := "imncsxrde"
	regex := regexp.MustCompile(`^/(.+)/([imncsxrde]*)$`)
	flagRE := regexp.MustCompile(fmt.Sprintf("[%s]+", vaildREModifiers))

	matches := regex.FindStringSubmatch(filter)
	if len(matches) <= 1 {
		return nil, nil
	}

	regexPattern := matches[1]

	pattern := ""
	if matches[2] != "" {
		if flagRE.MatchString(matches[2]) {
			pattern += "(?" + matches[2] + ")"
		} else {
			return nil, backend.DownstreamErrorf("error parsing regexp: unsupported flags `%s` (expected [%s])", matches[2], vaildREModifiers)
		}
	}
	pattern += regexPattern

	// Security: Compile regex with timeout protection
	compiled, err := safeRegexpCompile(pattern)
	if err != nil {
		return nil, backend.DownstreamErrorf("error parsing regexp: %v", err)
	}

	// Set match timeout for runtime DoS protection (5 second timeout)
	compiled.MatchTimeout = 5 * time.Second

	return compiled, nil
}

func isRegex(filter string) bool {
	regex := regexp.MustCompile(`^/(.+)/([imncsxrde]*)$`)
	return regex.MatchString(filter)
}

func itemTagToString(tag ItemTag) string {
	if tag.Value != "" {
		return fmt.Sprintf("%s: %s", tag.Tag, tag.Value)
	} else {
		return tag.Tag
	}
}

func parseItemTag(tagStr string) ItemTag {
	tag := ItemTag{}
	firstIdx := strings.Index(tagStr, ":")
	if firstIdx > 0 {
		tag.Tag = strings.TrimSpace(tagStr[:firstIdx])
		if firstIdx < len(tagStr)-1 {
			tag.Value = strings.TrimSpace(tagStr[firstIdx+1:])
		}
	} else {
		tag.Tag = strings.TrimSpace(tagStr)
	}
	return tag
}
