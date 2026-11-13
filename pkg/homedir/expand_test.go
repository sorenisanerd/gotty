package homedir

import (
	"testing"
)

func TestExpand(t *testing.T) {
	const fakeHome = "/home/test"
	t.Setenv("HOME", fakeHome)

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{name: "empty string", input: "", expected: ""},
		{name: "single dot", input: ".", expected: "."},
		{name: "single character", input: "a", expected: "a"},
		{name: "bare tilde", input: "~", expected: fakeHome},
		{name: "tilde with trailing slash", input: "~/", expected: fakeHome + "/"},
		{name: "tilde with subpath", input: "~/x", expected: fakeHome + "/x"},
		{name: "absolute path", input: "/abs", expected: "/abs"},
		{name: "relative path", input: "rel", expected: "rel"},
		{name: "tilde user unexpanded", input: "~user", expected: "~user"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := Expand(tc.input)
			if got != tc.expected {
				t.Errorf("Expand(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}
