package zabbix

import (
	"fmt"
	"regexp"
	"strings"
)

func (item *Item) ExpandItem() string {
	name := item.Name
	key := item.Key

	if strings.Index(key, "[") == -1 {
		return name
	}

	keyRunes := []rune(item.Key)
	keyParamsStr := string(keyRunes[strings.Index(key, "[")+1 : strings.LastIndex(key, "]")])
	keyParams := splitKeyParams(keyParamsStr)

	for i := len(keyParams); i >= 1; i-- {
		name = strings.ReplaceAll(name, fmt.Sprintf("$%v", i), keyParams[i-1])
	}

	return name
}

func splitKeyParams(paramStr string) []string {
	paramRunes := []rune(paramStr)
	params := []string{}
	quoted := false
	inArray := false
	splitSymbol := ","
	param := ""

	for _, r := range paramRunes {
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

func parseFilter(filter string) (*regexp.Regexp, error) {
	regex := regexp.MustCompile(`^/(.+)/(.*)$`)
	flagRE := regexp.MustCompile("[imsU]+")

	matches := regex.FindStringSubmatch(filter)
	if len(matches) <= 1 {
		return nil, nil
	}

	pattern := ""
	if matches[2] != "" {
		if flagRE.MatchString(matches[2]) {
			pattern += "(?" + matches[2] + ")"
		} else {
			return nil, fmt.Errorf("error parsing regexp: unsupported flags `%s` (expected [imsU])", matches[2])
		}
	}
	pattern += matches[1]

	return regexp.Compile(pattern)
}
