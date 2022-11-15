package utils

import "fmt"

func FormatWritesLog(codes []byte, line *string) {
	n := len(codes)
	str := ""
	exist := false
	if n == 3 {
		if str, exist = ASCIIGroupToStr(fmt.Sprintf("%X", codes)); exist {
			*line += str
			codes = nil
		}
	}
	// sh control codes
	if n >= 6 {
		if str, exist = ASCIIGroupToStr(fmt.Sprintf("%X", []byte{codes[0], codes[1], codes[n-1]})); exist {
			*line += str
			codes = nil
		}
	}

	if codes != nil {
		str = ASCIIToStr(codes)
		*line += str
	}

	return
}

func ASCIIToStr(codes []byte) string {
	control := map[byte]string{
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

	str := ""
	for _, code := range codes {
		if value, ok := control[code]; ok {
			str += value
		} else {
			str += string(code)
		}
	}

	return str
}

func ASCIIGroupToStr(sum string) (string, bool) {
	group := map[string]string{
		"1B5B41": "UP",
		"1B5B42": "DOWN",
		"1B5B43": "RIGHT",
		"1B5B44": "LEFT",
		// sh control codes: codes[0]codes[1]codes[5]
		// eg. "ESC[ 1;5 R"
		"1B5B52": "",
	}
	if value, ok := group[sum]; ok {
		return value, true
	}

	return "", false
}
