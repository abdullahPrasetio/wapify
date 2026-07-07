package api

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

// SetupDocumentationRoutes registers documentation endpoints
func SetupDocumentationRoutes(app *fiber.App) {
	v1 := app.Group("/api/v1", middleware.RequireAuth)
	v1.Get("/collections/:id/docs", getCollectionDocs)
	v1.Get("/collections/:id/docs/markdown", exportMarkdown)
	v1.Get("/collections/:id/docs/swagger", exportSwagger)
}

// collectionTree holds the resolved tree of folders and requests for a collection
type collectionTree struct {
	Collection repository.Collection
	Folders    []repository.Folder
	Requests   []repository.Request
}

// loadCollectionTree loads all data for a collection
func loadCollectionTree(collectionID string) (*collectionTree, error) {
	var col repository.Collection
	if err := repository.DB.First(&col, collectionID).Error; err != nil {
		return nil, err
	}
	var folders []repository.Folder
	repository.DB.Where("collection_id = ?", collectionID).Order("order_index asc, id asc").Find(&folders)
	var requests []repository.Request
	repository.DB.Where("collection_id = ?", collectionID).Order("order_index asc, id asc").Preload("Examples").Find(&requests)
	return &collectionTree{Collection: col, Folders: folders, Requests: requests}, nil
}

// --- Structured docs response ---

// DocFolder is a folder with its child requests for the docs viewer
type DocFolder struct {
	ID       uint         `json:"id"`
	Name     string       `json:"name"`
	ParentID *uint        `json:"parent_id"`
	Requests []DocRequest `json:"requests"`
}

// DocRequest is a simplified request for the docs viewer
type DocRequest struct {
	ID               uint                   `json:"id"`
	Name             string                 `json:"name"`
	Description      string                 `json:"description"`
	Method           string                 `json:"method"`
	URL              string                 `json:"url"`
	Headers          map[string]interface{} `json:"headers"`
	Body             map[string]interface{} `json:"body"`
	BodyType         string                 `json:"body_type"`
	FieldValidations map[string]interface{} `json:"field_validations"`
	Examples         []repository.RequestExample `json:"examples,omitempty"`
}

// DocResponse is the response structure for the docs viewer
type DocResponse struct {
	CollectionID   uint         `json:"collection_id"`
	CollectionName string       `json:"collection_name"`
	Description    string       `json:"description"`
	Folders        []DocFolder  `json:"folders"`
	Requests       []DocRequest `json:"root_requests"` // requests not in any folder
}

func getCollectionDocs(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	tree, err := loadCollectionTree(collectionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, tree.Collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	doc := buildDocResponse(tree)
	return c.JSON(doc)
}

func buildDocResponse(tree *collectionTree) DocResponse {
	// Map folder id → DocFolder
	folderMap := make(map[uint]*DocFolder)
	for _, f := range tree.Folders {
		fid := f.ID
		df := DocFolder{ID: f.ID, Name: f.Name, ParentID: f.ParentFolderID}
		folderMap[fid] = &df
	}

	// Assign requests to folders or root
	var rootRequests []DocRequest
	for _, r := range tree.Requests {
		dr := toDocRequest(r)
		if r.FolderID == nil {
			rootRequests = append(rootRequests, dr)
		} else {
			if df, ok := folderMap[*r.FolderID]; ok {
				df.Requests = append(df.Requests, dr)
			}
		}
	}

	// Build sorted folder list (parent folders first)
	var folders []DocFolder
	for _, f := range tree.Folders {
		if df, ok := folderMap[f.ID]; ok {
			folders = append(folders, *df)
		}
	}

	return DocResponse{
		CollectionID:   tree.Collection.ID,
		CollectionName: tree.Collection.Name,
		Description:    tree.Collection.Description,
		Folders:        folders,
		Requests:       rootRequests,
	}
}

func toDocRequest(r repository.Request) DocRequest {
	headers := make(map[string]interface{})
	for k, v := range r.Headers {
		headers[k] = v
	}
	body := make(map[string]interface{})
	for k, v := range r.Body {
		body[k] = v
	}
	fieldValidations := make(map[string]interface{})
	for k, v := range r.FieldValidations {
		fieldValidations[k] = v
	}
	return DocRequest{
		ID:               r.ID,
		Name:             r.Name,
		Description:      r.Description,
		Method:           r.Method,
		URL:              r.URL,
		Headers:          headers,
		Body:             body,
		BodyType:         r.BodyType,
		FieldValidations: fieldValidations,
		Examples:         r.Examples,
	}
}

// --- Markdown export ---

func exportMarkdown(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	tree, err := loadCollectionTree(collectionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, tree.Collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	md := generateMarkdown(tree)
	filename := sanitizeFilename(tree.Collection.Name) + ".md"

	c.Set("Content-Type", "text/markdown; charset=utf-8")
	c.Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	return c.SendString(md)
}

func generateMarkdown(tree *collectionTree) string {
	var sb strings.Builder
	col := tree.Collection

	sb.WriteString(fmt.Sprintf("# %s\n\n", col.Name))
	if col.Description != "" {
		sb.WriteString(col.Description + "\n\n")
	}
	sb.WriteString("---\n\n")

	// Build folder map
	folderMap := make(map[uint]repository.Folder)
	for _, f := range tree.Folders {
		folderMap[f.ID] = f
	}

	// Group requests by folder
	type folderGroup struct {
		folder   *repository.Folder
		requests []repository.Request
	}

	groups := make(map[*uint]folderGroup)
	var folderOrder []*uint

	for i := range tree.Requests {
		r := tree.Requests[i]
		key := r.FolderID
		if _, exists := groups[key]; !exists {
			g := folderGroup{requests: []repository.Request{}}
			if key != nil {
				f := folderMap[*key]
				g.folder = &f
			}
			groups[key] = g
			folderOrder = append(folderOrder, key)
		}
		g := groups[key]
		g.requests = append(g.requests, r)
		groups[key] = g
	}

	for _, key := range folderOrder {
		group := groups[key]
		if group.folder != nil {
			sb.WriteString(fmt.Sprintf("## 📁 %s\n\n", group.folder.Name))
		} else {
			sb.WriteString("## General\n\n")
		}

		for _, r := range group.requests {
			sb.WriteString(fmt.Sprintf("### %s %s\n\n", r.Method, r.Name))
			if r.Description != "" {
				sb.WriteString(r.Description + "\n\n")
			}
			sb.WriteString(fmt.Sprintf("**URL:** `%s`\n\n", r.URL))
			sb.WriteString(fmt.Sprintf("**Method:** `%s`\n\n", r.Method))

			if len(r.Headers) > 0 {
				sb.WriteString("**Headers:**\n\n")
				sb.WriteString("| Key | Value |\n|---|---|\n")
				keys := sortedKeys(r.Headers)
				for _, k := range keys {
					sb.WriteString(fmt.Sprintf("| `%s` | `%v` |\n", k, r.Headers[k]))
				}
				sb.WriteString("\n")
			}

			if len(r.Body) > 0 {
				sb.WriteString("**Request Body:**\n\n")
				bodyJSON, _ := json.MarshalIndent(r.Body, "", "  ")
				sb.WriteString("```json\n" + string(bodyJSON) + "\n```\n\n")
			}

			sb.WriteString("---\n\n")
		}
	}

	return sb.String()
}

// --- Swagger / OpenAPI 3.0 export ---

func exportSwagger(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	tree, err := loadCollectionTree(collectionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, tree.Collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	spec := generateSwagger(tree)
	filename := sanitizeFilename(tree.Collection.Name) + "_openapi.json"

	c.Set("Content-Type", "application/json; charset=utf-8")
	c.Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	return c.JSON(spec)
}

// OpenAPI 3.0 structure
type openAPISpec struct {
	OpenAPI string                 `json:"openapi"`
	Info    openAPIInfo            `json:"info"`
	Paths   map[string]interface{} `json:"paths"`
	Tags    []openAPITag           `json:"tags,omitempty"`
}

type openAPIInfo struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Version     string `json:"version"`
}

type openAPITag struct {
	Name string `json:"name"`
}

func generateSwagger(tree *collectionTree) openAPISpec {
	spec := openAPISpec{
		OpenAPI: "3.0.3",
		Info: openAPIInfo{
			Title:       tree.Collection.Name,
			Description: tree.Collection.Description,
			Version:     "1.0.0",
		},
		Paths: make(map[string]interface{}),
	}

	// Build folder map for tags
	folderMap := make(map[uint]string)
	for _, f := range tree.Folders {
		folderMap[f.ID] = f.Name
		spec.Tags = append(spec.Tags, openAPITag{Name: f.Name})
	}

	for _, r := range tree.Requests {
		// Normalize URL path: strip base URL if present
		urlPath := extractURLPath(r.URL)
		method := strings.ToLower(r.Method)

		// Build operation
		operation := map[string]interface{}{
			"operationId": fmt.Sprintf("%s_%d", method, r.ID),
			"summary":     r.Name,
		}
		if r.Description != "" {
			operation["description"] = r.Description
		}

		// Tags from folder
		if r.FolderID != nil {
			if folderName, ok := folderMap[*r.FolderID]; ok {
				operation["tags"] = []string{folderName}
			}
		}

		// Headers as parameters
		var params []map[string]interface{}
		for k, v := range r.Headers {
			param := map[string]interface{}{
				"name":     k,
				"in":       "header",
				"required": false,
				"example":  v,
				"schema":   map[string]string{"type": "string"},
			}
			params = append(params, param)
		}
		if len(params) > 0 {
			operation["parameters"] = params
		}

		// Request body for POST/PUT/PATCH — include examples from RequestExample
		if method == "post" || method == "put" || method == "patch" {
			schema := map[string]interface{}{"type": "object"}
			if len(r.Body) > 0 {
				schema["example"] = r.Body
			}
			jsonContent := map[string]interface{}{"schema": schema}

			// Collect named request examples
			reqExamples := map[string]interface{}{}
			for _, ex := range r.Examples {
				if len(ex.RequestBody) > 0 {
					reqExamples[ex.Name] = map[string]interface{}{"value": ex.RequestBody}
				}
			}
			if len(reqExamples) > 0 {
				jsonContent["examples"] = reqExamples
			}

			if len(r.Body) > 0 || len(reqExamples) > 0 {
				operation["requestBody"] = map[string]interface{}{
					"required": true,
					"content":  map[string]interface{}{"application/json": jsonContent},
				}
			}
		}

		// Responses — built from RequestExample entries
		responses := map[string]interface{}{}
		// Group examples by status code, collecting multiple examples per status
		type statusGroup struct {
			description string
			examples    map[string]interface{}
			headers     map[string]interface{}
		}
		statusGroups := map[string]*statusGroup{}
		for _, ex := range r.Examples {
			statusKey := fmt.Sprintf("%d", ex.ResponseStatus)
			if _, ok := statusGroups[statusKey]; !ok {
				statusGroups[statusKey] = &statusGroup{
					description: httpStatusText(ex.ResponseStatus),
					examples:    map[string]interface{}{},
					headers:     map[string]interface{}{},
				}
			}
			sg := statusGroups[statusKey]

			// Parse response body
			if ex.ResponseBody != "" {
				var parsed interface{}
				if json.Unmarshal([]byte(ex.ResponseBody), &parsed) == nil {
					sg.examples[ex.Name] = map[string]interface{}{"value": parsed}
				} else {
					sg.examples[ex.Name] = map[string]interface{}{"value": ex.ResponseBody}
				}
			}

			// Response headers
			for k, v := range ex.ResponseHeaders {
				sg.headers[k] = map[string]interface{}{
					"schema":  map[string]string{"type": "string"},
					"example": v,
				}
			}
		}

		for statusKey, sg := range statusGroups {
			resp := map[string]interface{}{"description": sg.description}
			if len(sg.examples) > 0 {
				resp["content"] = map[string]interface{}{
					"application/json": map[string]interface{}{
						"schema":   map[string]interface{}{"type": "object"},
						"examples": sg.examples,
					},
				}
			}
			if len(sg.headers) > 0 {
				resp["headers"] = sg.headers
			}
			responses[statusKey] = resp
		}

		if len(responses) == 0 {
			responses["200"] = map[string]interface{}{"description": "Success"}
		}
		operation["responses"] = responses

		// Add to paths
		if spec.Paths[urlPath] == nil {
			spec.Paths[urlPath] = make(map[string]interface{})
		}
		pathItem := spec.Paths[urlPath].(map[string]interface{})
		pathItem[method] = operation
	}

	return spec
}

// --- Helpers ---

func extractURLPath(rawURL string) string {
	// Remove protocol and host
	rawURL = strings.TrimSpace(rawURL)
	if idx := strings.Index(rawURL, "://"); idx != -1 {
		rawURL = rawURL[idx+3:]
	}
	// Remove host part (first segment before /)
	if idx := strings.Index(rawURL, "/"); idx != -1 {
		rawURL = rawURL[idx:]
	} else {
		return "/"
	}
	// Remove query string
	if idx := strings.Index(rawURL, "?"); idx != -1 {
		rawURL = rawURL[:idx]
	}
	// Replace {{variable}} with {variable} for OpenAPI
	rawURL = strings.ReplaceAll(rawURL, "{{", "{")
	rawURL = strings.ReplaceAll(rawURL, "}}", "}")
	if rawURL == "" {
		return "/"
	}
	return rawURL
}

func sanitizeFilename(name string) string {
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-' {
			return r
		}
		return '_'
	}, name)
	return name
}

func httpStatusText(code int) string {
	texts := map[int]string{
		200: "OK", 201: "Created", 204: "No Content",
		400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
		404: "Not Found", 409: "Conflict", 422: "Unprocessable Entity",
		500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
	}
	if t, ok := texts[code]; ok {
		return t
	}
	return fmt.Sprintf("Status %d", code)
}

func sortedKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
