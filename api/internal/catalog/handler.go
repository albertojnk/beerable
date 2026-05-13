package catalog

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	Repo *Repository
}

type createProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Price       float64 `json:"price" binding:"required"`
	ImageURL    *string `json:"image_url"`
	CategoryID  *string `json:"category_id"`
	IsAvailable *bool   `json:"is_available"`
}

type updateProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Price       float64 `json:"price" binding:"required"`
	ImageURL    *string `json:"image_url"`
	CategoryID  *string `json:"category_id"`
	IsAvailable *bool   `json:"is_available"`
}

type createCategoryRequest struct {
	Name      string `json:"name" binding:"required"`
	SortOrder int    `json:"sort_order"`
}

func (h *Handler) ListProducts(c *gin.Context) {
	estID := c.GetString("user_id")
	products, err := h.Repo.ListProducts(estID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list products"})
		return
	}
	c.JSON(http.StatusOK, products)
}

func (h *Handler) CreateProduct(c *gin.Context) {
	var req createProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and price required"})
		return
	}

	avail := true
	if req.IsAvailable != nil {
		avail = *req.IsAvailable
	}

	p := &Product{
		EstablishmentID: c.GetString("user_id"),
		Name:            req.Name,
		Description:     req.Description,
		Price:           req.Price,
		ImageURL:        req.ImageURL,
		CategoryID:      req.CategoryID,
		IsAvailable:     avail,
	}

	if err := h.Repo.CreateProduct(p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create product"})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *Handler) UpdateProduct(c *gin.Context) {
	var req updateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and price required"})
		return
	}

	avail := true
	if req.IsAvailable != nil {
		avail = *req.IsAvailable
	}

	p := &Product{
		ID:              c.Param("id"),
		EstablishmentID: c.GetString("user_id"),
		Name:            req.Name,
		Description:     req.Description,
		Price:           req.Price,
		ImageURL:        req.ImageURL,
		CategoryID:      req.CategoryID,
		IsAvailable:     avail,
	}

	if err := h.Repo.UpdateProduct(p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update product"})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	estID := c.GetString("user_id")
	if err := h.Repo.DeleteProduct(c.Param("id"), estID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete product"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) ListCategories(c *gin.Context) {
	estID := c.GetString("user_id")
	cats, err := h.Repo.ListCategories(estID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list categories"})
		return
	}
	c.JSON(http.StatusOK, cats)
}

func (h *Handler) CreateCategory(c *gin.Context) {
	var req createCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}

	cat := &Category{
		EstablishmentID: c.GetString("user_id"),
		Name:            req.Name,
		SortOrder:       req.SortOrder,
	}

	if err := h.Repo.CreateCategory(cat); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create category"})
		return
	}
	c.JSON(http.StatusCreated, cat)
}

func (h *Handler) GetMenu(c *gin.Context) {
	estID := c.Param("id")
	categories, err := h.Repo.ListCategories(estID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load menu"})
		return
	}
	products, err := h.Repo.ListAvailableProducts(estID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load menu"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": categories, "products": products})
}
