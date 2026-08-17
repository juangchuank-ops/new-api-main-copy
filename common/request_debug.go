package common

import (
	"encoding/base64"
	"mime"
	"strings"
	"unicode/utf8"
)

const (
	// RequestDebugBodyLimit bounds the in-memory preview captured alongside
	// the full body. The full body (up to RequestDebugBodyMaxBytes) is stored
	// in the database; this limit only affects the inline preview.
	RequestDebugBodyLimit = 32 * 1024
)

// RequestDebugBodyRepresentation formats an already bounded body for the
// root-only on-demand diagnostics endpoint. Text and JSON remain readable;
// other data is base64 encoded.
func RequestDebugBodyRepresentation(data []byte, contentType string, truncated bool) map[string]interface{} {
	if truncated && isTextualRequestDebugContentType(contentType) {
		data = trimIncompleteUTF8Tail(data)
	}
	result := map[string]interface{}{"body_truncated": truncated}
	if isDisplayableRequestDebugBody(data, contentType) {
		result["body"] = string(data)
	} else {
		result["body"] = base64.StdEncoding.EncodeToString(data)
		result["body_encoding"] = "base64"
	}
	return result
}

func trimIncompleteUTF8Tail(data []byte) []byte {
	if utf8.Valid(data) || len(data) == 0 {
		return data
	}

	for trim := 1; trim < utf8.UTFMax && trim <= len(data); trim++ {
		prefixEnd := len(data) - trim
		if !utf8.Valid(data[:prefixEnd]) || !isUTF8RunePrefix(data[prefixEnd:]) {
			continue
		}
		return data[:prefixEnd]
	}
	return data
}

func isUTF8RunePrefix(data []byte) bool {
	if len(data) == 0 || len(data) >= utf8.UTFMax {
		return false
	}
	width := utf8PartialWidth(data[0])
	if width <= 1 || len(data) >= width {
		return false
	}
	for _, b := range data[1:] {
		if b&0xc0 != 0x80 {
			return false
		}
	}

	completed := make([]byte, width)
	copy(completed, data)
	for i := len(data); i < width; i++ {
		completed[i] = 0x80
	}
	if len(data) == 1 {
		switch completed[0] {
		case 0xe0:
			completed[1] = 0xa0
		case 0xf0:
			completed[1] = 0x90
		}
	}
	return utf8.Valid(completed)
}

func utf8PartialWidth(first byte) int {
	switch {
	case first >= 0xc2 && first <= 0xdf:
		return 2
	case first >= 0xe0 && first <= 0xef:
		return 3
	case first >= 0xf0 && first <= 0xf4:
		return 4
	default:
		return 1
	}
}

func isTextualRequestDebugContentType(contentType string) bool {
	mediaType, _, err := mime.ParseMediaType(contentType)
	return err == nil && (strings.Contains(mediaType, "json") || strings.HasPrefix(mediaType, "text/") || mediaType == "application/x-www-form-urlencoded")
}

func isDisplayableRequestDebugBody(data []byte, contentType string) bool {
	if !utf8.Valid(data) {
		return false
	}
	if isTextualRequestDebugContentType(contentType) {
		return true
	}
	for _, r := range string(data) {
		if r < 0x20 && r != '\n' && r != '\r' && r != '\t' {
			return false
		}
	}
	return true
}
