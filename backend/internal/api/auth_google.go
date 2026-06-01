package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

func googleOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  os.Getenv("GOOGLE_REDIRECT_URI"),
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

type googleUserInfo struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func isGoogleOAuthEnabled() bool {
	return os.Getenv("GOOGLE_OAUTH_ENABLED") == "true"
}

func SetupGoogleAuthRoutes(app *fiber.App) {
	authGroup := app.Group("/api/v1/auth")
	authGroup.Get("/google/status", GoogleOAuthStatus)
	authGroup.Get("/google", GoogleOAuthLogin)
	authGroup.Get("/google/callback", GoogleOAuthCallback)
}

func GoogleOAuthStatus(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"enabled": isGoogleOAuthEnabled()})
}

// GoogleOAuthLogin redirects the user to Google's OAuth consent page.
func GoogleOAuthLogin(c *fiber.Ctx) error {
	if !isGoogleOAuthEnabled() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Google Sign-In is not enabled on this server",
			"code":  "GOOGLE_OAUTH_DISABLED",
		})
	}
	cfg := googleOAuthConfig()
	url := cfg.AuthCodeURL("wapbolt-state", oauth2.AccessTypeOffline)
	return c.Redirect(url, fiber.StatusTemporaryRedirect)
}

// GoogleOAuthCallback handles the OAuth callback from Google.
// On success it redirects to wapbolt://auth/callback?token=...&refresh_token=...
func GoogleOAuthCallback(c *fiber.Ctx) error {
	code := c.Query("code")
	if code == "" {
		return renderErrorPage(c, "Missing authorization code from Google")
	}

	cfg := googleOAuthConfig()
	oauthToken, err := cfg.Exchange(context.Background(), code)
	if err != nil {
		return renderErrorPage(c, "Failed to exchange authorization code: "+err.Error())
	}

	info, err := fetchGoogleUserInfo(oauthToken.AccessToken)
	if err != nil {
		return renderErrorPage(c, "Failed to fetch user info from Google: "+err.Error())
	}

	user, err := findOrCreateGoogleUser(info)
	if err != nil {
		return renderErrorPage(c, "Failed to create or find user: "+err.Error())
	}

	token, refreshToken, err := generateTokenPair(user)
	if err != nil {
		return renderErrorPage(c, "Failed to generate tokens: "+err.Error())
	}

	deepLink := fmt.Sprintf("wapbolt://auth/callback?token=%s&refresh_token=%s",
		url.QueryEscape(token), url.QueryEscape(refreshToken))
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <title>Wapbolt Login Berhasil</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 60px;
           background: #0f0f0f; color: #e0e0e0; }
    h2 { color: #4ade80; }
    p  { color: #888; margin-top: 12px; }
  </style>
</head>
<body>
  <h2>Login Berhasil!</h2>
  <p>Kembali ke Wapbolt...</p>
  <p style="font-size:12px;margin-top:24px;">Jika tidak otomatis, tutup tab ini secara manual.</p>
  <script>
    window.location.href = '%s';
    setTimeout(function() { window.close(); }, 1000);
  </script>
</body>
</html>`, deepLink)
	return c.Type("html").SendString(html)
}

func fetchGoogleUserInfo(accessToken string) (*googleUserInfo, error) {
	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var info googleUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

func findOrCreateGoogleUser(info *googleUserInfo) (*repository.User, error) {
	var user repository.User

	// Try find by google_id first
	if err := repository.DB.Where("google_id = ?", info.ID).First(&user).Error; err == nil {
		return &user, nil
	}

	// Try find by email (link Google to existing account)
	if err := repository.DB.Where("email = ?", info.Email).First(&user).Error; err == nil {
		user.GoogleID = &info.ID
		if err := repository.DB.Save(&user).Error; err != nil {
			return nil, err
		}
		return &user, nil
	}

	// Create new user + team
	googleID := info.ID
	user = repository.User{
		Email:    info.Email,
		Name:     info.Name,
		GoogleID: &googleID,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		return nil, err
	}

	user.RoleSignature = CalculateRoleSignature(user.ID, user.Email, user.IsSuperAdmin)
	if err := repository.DB.Save(&user).Error; err != nil {
		return nil, err
	}

	// Auto-create personal workspace named after the user
	team := repository.Team{
		Name:        info.Name + "'s Workspace",
		Description: "Personal workspace",
		CreatedByID: &user.ID,
	}
	if err := repository.DB.Create(&team).Error; err != nil {
		return nil, err
	}

	member := repository.TeamMember{
		TeamID:   team.ID,
		UserID:   user.ID,
		Role:     "admin",
		JoinedAt: time.Now(),
	}
	if err := repository.DB.Create(&member).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func generateTokenPair(user *repository.User) (string, string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":        user.ID,
		"email":          user.Email,
		"is_super_admin": user.IsSuperAdmin,
		"exp":            time.Now().Add(time.Hour * 24).Unix(),
	})
	t, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return "", "", err
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"exp":     time.Now().Add(time.Hour * 24 * 90).Unix(),
	})
	rt, err := refreshToken.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return "", "", err
	}

	return t, rt, nil
}

func renderErrorPage(c *fiber.Ctx, message string) error {
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><title>Wapbolt — Auth Error</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f0f0f;color:#f44336;">
  <h2>Authentication Failed</h2>
  <p>%s</p>
  <p style="color:#888;margin-top:24px;">You can close this window and try again in Wapbolt.</p>
</body>
</html>`, message)
	return c.Status(fiber.StatusBadRequest).Type("html").SendString(html)
}
