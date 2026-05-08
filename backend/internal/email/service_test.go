package email

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSendWelcomeEmail_Skip(t *testing.T) {
	// Ensure API key is empty or placeholder
	os.Setenv("RESEND_API_KEY", "")
	defer os.Unsetenv("RESEND_API_KEY")

	err := SendWelcomeEmail("test@test.com", "Test", "pass")
	assert.NoError(t, err)

	os.Setenv("RESEND_API_KEY", "re_placeholder_key")
	err = SendWelcomeEmail("test@test.com", "Test", "pass")
	assert.NoError(t, err)
}
