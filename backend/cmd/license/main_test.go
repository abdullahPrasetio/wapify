package main

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRun(t *testing.T) {
	t.Run("No args", func(t *testing.T) {
		out := &bytes.Buffer{}
		err := Run([]string{"cmd"}, out)
		assert.Error(t, err)
		assert.Contains(t, out.String(), "Wapbolt License CLI Usage:")
	})

	t.Run("Unknown command", func(t *testing.T) {
		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "unknown"}, out)
		assert.Error(t, err)
		assert.Contains(t, out.String(), "Wapbolt License CLI Usage:")
	})

	t.Run("keygen", func(t *testing.T) {
		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "keygen"}, out)
		assert.NoError(t, err)
		assert.Contains(t, out.String(), "LICENSE_PRIVATE_KEY=")
		assert.Contains(t, out.String(), "LICENSE_PUBLIC_KEY=")
	})

	t.Run("generate missing flags", func(t *testing.T) {
		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "generate"}, out)
		assert.Error(t, err)
		assert.Contains(t, out.String(), "Error: --name and --email are required")
	})

	t.Run("generate success", func(t *testing.T) {
		_, priv, _ := ed25519.GenerateKey(nil)
		privB64 := base64.StdEncoding.EncodeToString(priv)

		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "generate", "--name", "Test", "--email", "test@test.com", "--private-key", privB64}, out)
		assert.NoError(t, err)
		assert.Contains(t, out.String(), "LICENSE_KEY:")
	})

	t.Run("generate with env key", func(t *testing.T) {
		_, priv, _ := ed25519.GenerateKey(nil)
		privB64 := base64.StdEncoding.EncodeToString(priv)
		os.Setenv("LICENSE_PRIVATE_KEY", privB64)
		defer os.Unsetenv("LICENSE_PRIVATE_KEY")

		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "generate", "--name", "Test", "--email", "test@test.com"}, out)
		assert.NoError(t, err)
		assert.Contains(t, out.String(), "LICENSE_KEY:")
	})

	t.Run("generate fail missing key", func(t *testing.T) {
		os.Setenv("GO_ENV", "test")
		defer os.Unsetenv("GO_ENV")
		os.Unsetenv("LICENSE_PRIVATE_KEY")
		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "generate", "--name", "Test", "--email", "test@test.com"}, out)
		if assert.Error(t, err) {
			assert.Contains(t, strings.ToLower(err.Error()), "license private key is not provided")
		}
	})

	t.Run("generate invalid key format", func(t *testing.T) {
		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "generate", "--name", "Test", "--email", "test@test.com", "--private-key", "invalid-b64"}, out)
		assert.Error(t, err)
	})

	t.Run("generate invalid duration", func(t *testing.T) {
		_, priv, _ := ed25519.GenerateKey(nil)
		privB64 := base64.StdEncoding.EncodeToString(priv)

		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "generate", "--name", "T", "--email", "e", "--private-key", privB64, "--duration", "invalid"}, out)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Invalid duration")
	})

	t.Run("generate various durations", func(t *testing.T) {
		_, priv, _ := ed25519.GenerateKey(nil)
		privB64 := base64.StdEncoding.EncodeToString(priv)

		durations := []string{"1minute", "3minutes", "5minute", "10minutes", "1month", "lifetime"}
		for _, d := range durations {
			out := &bytes.Buffer{}
			err := Run([]string{"cmd", "generate", "--name", "T", "--email", "e", "--private-key", privB64, "--duration", d}, out)
			assert.NoError(t, err, "failed for duration %s", d)
		}
	})
}
