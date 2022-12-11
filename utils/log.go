package utils

import "fmt"

var CtrlChar = map[byte]string{
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

var CtrlCharGroup = map[string]string{
	"1B5B41": "UP",
	"1B5B42": "DOWN",
	"1B5B43": "RIGHT",
	"1B5B44": "LEFT",

	// shell control codes
	// codes[0]+codes[1]+codes[n-1]
	// for example:
	// [1B(ESC) 5B([) 32(2)       3B(;) 35(5) 52(R)]: row 2  col 5
	// [1B(ESC) 5B([) 31(1) 30(0) 3B(;) 35(5) 52(R)]: row 10 col 5
	// [1B(ESC) 5B([) 32(2) 32(2) 3B(;) 35(5) 52(R)]: row 22 col 5
	"1B5B52": "",

	// maybe there will be more control char group
	// ...
}

func FormatWriteLog(codes []byte, line *string) {
	n := len(codes)
	// when user uses the keyboard arrow keys
	// arrow keys are combination of 3 ASCII codes
	if n == 3 {
		if str, exist := ASCIIGroupToStr(fmt.Sprintf("%X", codes)); exist {
			*line += str
			return
		}
	}
	// for some shells
	// they will automatically send some control characters
	// after typing the command and pressing Enter
	// which indicate the current row and column.
	if n >= 6 {
		if str, exist := ASCIIGroupToStr(fmt.Sprintf("%X", []byte{codes[0], codes[1], codes[n-1]})); exist {
			*line += str
			return
		}
	}

	str := ASCIIToStr(codes)
	*line += str

	return
}

func ASCIIToStr(codes []byte) (str string) {
	for _, code := range codes {
		if value, ok := CtrlChar[code]; ok {
			str += value
		} else {
			str += string(code)
		}
	}

	return
}

func ASCIIGroupToStr(group string) (string, bool) {
	if value, ok := CtrlCharGroup[group]; ok {
		return value, true
	}

	return "", false
}
