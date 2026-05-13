package order

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	Service *Service
	Repo    *Repository
}

type createOrderRequest struct {
	EstablishmentID string     `json:"establishment_id" binding:"required"`
	Items           []CartItem `json:"items" binding:"required"`
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var req createOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "establishment_id and items required"})
		return
	}

	customerID := c.GetString("user_id")
	result, err := h.Service.CreateOrder(customerID, req.EstablishmentID, req.Items)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

func (h *Handler) GetOrder(c *gin.Context) {
	orderID := c.Param("id")
	order, err := h.Repo.GetByID(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	c.JSON(http.StatusOK, order)
}

func (h *Handler) MyOrders(c *gin.Context) {
	customerID := c.GetString("user_id")
	orders, err := h.Repo.ListByCustomer(customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list orders"})
		return
	}
	c.JSON(http.StatusOK, orders)
}

func (h *Handler) ListEstablishmentOrders(c *gin.Context) {
	estID := c.GetString("user_id")
	orders, err := h.Repo.ListByEstablishment(estID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list orders"})
		return
	}
	c.JSON(http.StatusOK, orders)
}
