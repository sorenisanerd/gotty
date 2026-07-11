package server

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/pquerna/otp/totp"
)

func (server *Server) wrapLogger(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rw := &logResponseWriter{w, 200}
		handler.ServeHTTP(rw, r)
		log.Printf("%s %d %s %s", r.RemoteAddr, rw.status, r.Method, r.URL.Path)
	})
}

func (server *Server) wrapHeaders(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// todo add version
		w.Header().Set("Server", "GoTTY")
		handler.ServeHTTP(w, r)
	})
}

func (server *Server) wrapBasicAuth(handler http.Handler, credential string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.SplitN(r.Header.Get("Authorization"), " ", 2)

		if len(token) != 2 || strings.ToLower(token[0]) != "basic" {
			w.Header().Set("WWW-Authenticate", `Basic realm="GoTTY"`)
			http.Error(w, "Bad Request", http.StatusUnauthorized)
			return
		}

		payload, err := base64.StdEncoding.DecodeString(token[1])
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		if credential != string(payload) {
			w.Header().Set("WWW-Authenticate", `Basic realm="GoTTY"`)
			http.Error(w, "authorization failed", http.StatusUnauthorized)
			return
		}

		log.Printf("Basic Authentication Succeeded: %s", r.RemoteAddr)
		handler.ServeHTTP(w, r)
	})
}

func (server *Server) wrapTOTPAuth(handler http.Handler, pathPrefix string, secret string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == pathPrefix+"totp-auth" {
			handler.ServeHTTP(w, r)
			return
		}

		salt, err := r.Cookie("salt")

		if err != nil && err != http.ErrNoCookie {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		if err == http.ErrNoCookie {
			http.Redirect(w, r, pathPrefix+"totp-auth", http.StatusSeeOther)
			return
		}

		token, err := r.Cookie("token")

		if err != nil && err != http.ErrNoCookie {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		if err == http.ErrNoCookie {
			passcode, err := r.Cookie("passcode")

			if err != nil && err != http.ErrNoCookie {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			if err == http.ErrNoCookie {
				http.Redirect(w, r, pathPrefix+"totp-auth", http.StatusSeeOther)
				return
			}

			if !totp.Validate(passcode.Value, secret) {
				http.Redirect(w, r, pathPrefix+"totp-auth", http.StatusSeeOther)
				return
			}

			http.SetCookie(w, &http.Cookie{
				Name:    "passcode",
				Path:    pathPrefix,
				MaxAge:  -1,
				Expires: time.Unix(0, 0),
			})

			sum := sha256.Sum256([]byte(secret + salt.Value))
			token := hex.EncodeToString(sum[:])
			http.SetCookie(w, &http.Cookie{
				Name:   "token",
				Value:  token,
				Path:   pathPrefix,
				MaxAge: 0,
			})

			log.Printf("TOTP Authentication Succeeded: %s", r.RemoteAddr)
			handler.ServeHTTP(w, r)
			return
		}

		sum := sha256.Sum256([]byte(secret + salt.Value))
		if hex.EncodeToString(sum[:]) != token.Value {
			http.Redirect(w, r, pathPrefix+"totp-auth", http.StatusSeeOther)
			return
		}

		log.Printf("TOTP Authentication Succeeded: %s", r.RemoteAddr)
		handler.ServeHTTP(w, r)
	})
}
