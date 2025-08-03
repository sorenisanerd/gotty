package utils

import (
	"fmt"
	"regexp"
)

var ControlCodes = map[byte]string{
	0:   "NUL",
	1:   "SOH",
	2:   "STX",
	3:   "ETX",
	4:   "EOT",
	5:   "ENQ",
	6:   "ACK",
	7:   "BEL",
	8:   "BS",
	9:   "HT",
	10:  "LF",
	11:  "VT",
	12:  "FF",
	13:  "CR",
	14:  "SO",
	15:  "SI",
	16:  "DLE",
	17:  "DCI",
	18:  "DC2",
	19:  "DC3",
	20:  "DC4",
	21:  "NAK",
	22:  "SYN",
	23:  "TB",
	24:  "CAN",
	25:  "EM",
	26:  "SUB",
	27:  "ESC",
	28:  "FS",
	29:  "GS",
	30:  "RS",
	31:  "US",
	32:  "SPACE",
	127: "DEL",
}

// https://en.wikipedia.org/wiki/ANSI_escape_code
// https://xtermjs.org/docs/api/vtfeatures/
var ControlSequences = map[string]string{
	// Cursor Up
	"ESC[A": "CUU",
	// Cursor Down
	"ESC[B": "CUD",
	// Cursor Forward
	"ESC[C": "CUF",
	// Cursor Back
	"ESC[D": "CUB",
}

var ControlSequencePatterns = map[string]string{
	// Device Status Report
	// Reports the cursor position (CPR) by transmitting `ESC[n;mR`, where n is the row and m is the column.
	"^ESC\\[\\d+;\\d+R$": "",
}

func ControlCodesToStr(codes []byte) (str string) {
	for _, code := range codes {
		if value, ok := ControlCodes[code]; ok {
			str += value
		} else {
			str += string(code)
		}
	}
	return
}

func ControlCodesToEscapedStr(codes []byte) (str string) {
	for _, code := range codes {
		if value, ok := ControlCodes[code]; ok {
			str += fmt.Sprintf("[%s]", value)
		} else if code == 91 || code == 92 || code == 93 {
			// escaping [ ] \
			str += fmt.Sprintf("\\%s", string(code))
		} else {
			str += string(code)
		}
	}
	return
}

func ControlSequenceToStr(codes []byte) (string, bool) {
	sequence := ControlCodesToStr(codes)
	for key, value := range ControlSequences {
		if key == sequence {
			return fmt.Sprintf("[%s]", value), true
		}
	}

	for key, value := range ControlSequencePatterns {
		if regexp.MustCompile(key).Match([]byte(sequence)) {
			return value, true
		}
	}
	return sequence, false
}

func FormatWriteLog(codes []byte, line *string) {
	n := len(codes)
	if n >= 3 {
		if str, exists := ControlSequenceToStr(codes); exists {
			*line += str
			return
		}
	}
	*line += ControlCodesToEscapedStr(codes)
}
