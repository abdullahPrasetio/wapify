package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

type SearchSummary struct {
	Requests    []RequestMinimal    `json:"requests"`
	Collections []CollectionMinimal `json:"collections"`
}

type RequestMinimal struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	URL          string `json:"url"`
	Method       string `json:"method"`
	TeamID       uint   `json:"team_id"`
	CollectionID uint   `json:"collection_id"`
}

type CollectionMinimal struct {
	ID     uint   `json:"id"`
	Name   string `json:"name"`
	TeamID uint   `json:"team_id"`
}

func SetupSearchRoutes(app *fiber.App) {
	api := app.Group("/api/v1/search", middleware.JWTProtected())
	api.Get("/summary", getSearchSummary)
}

func getSearchSummary(c *fiber.Ctx) error {
	user := middleware.GetUserFromCtx(c)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var teamIDs []uint
	if user.IsSuperAdmin {
		// Super Admin sees all teams
		var teams []repository.Team
		repository.DB.Find(&teams)
		for _, t := range teams {
			teamIDs = append(teamIDs, t.ID)
		}
	} else {
		// Normal user sees teams they belong to
		var memberships []repository.TeamMember
		repository.DB.Where("user_id = ?", user.ID).Find(&memberships)
		for _, m := range memberships {
			teamIDs = append(teamIDs, m.TeamID)
		}
	}

	if len(teamIDs) == 0 {
		return c.JSON(SearchSummary{
			Requests:    []RequestMinimal{},
			Collections: []CollectionMinimal{},
		})
	}

	collections := []CollectionMinimal{}
	repository.DB.Table("collections").
		Select("id, name, team_id").
		Where("team_id IN ?", teamIDs).
		Scan(&collections)

	requests := []RequestMinimal{}
	repository.DB.Table("requests").
		Select("requests.id, requests.name, requests.url, requests.method, collections.team_id, requests.collection_id").
		Joins("JOIN collections ON collections.id = requests.collection_id").
		Where("collections.team_id IN ?", teamIDs).
		Scan(&requests)

	return c.JSON(SearchSummary{
		Requests:    requests,
		Collections: collections,
	})
}
