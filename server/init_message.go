package server

type InitMessage struct {
	Type      string `json:"Arguments,omitempty"`
	Arguments string `json:"Arguments,omitempty"`
	AuthToken string `json:"AuthToken,omitempty"`
}
