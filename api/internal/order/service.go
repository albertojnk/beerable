package order

import (
	"fmt"

	"github.com/beerable/marketplace-mvp/internal/catalog"
	"github.com/beerable/marketplace-mvp/internal/payment"
	"github.com/google/uuid"
)

type CartItem struct {
	ProductID string `json:"product_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required"`
}

type Service struct {
	OrderRepo   *Repository
	CatalogRepo *catalog.Repository
	Payment     *payment.Client
}

type CreateOrderResult struct {
	Order      *Order      `json:"order"`
	Items      []OrderItem `json:"items"`
	PixQRCode  string      `json:"pix_qr_code"`
	PixExpires string      `json:"pix_expiration"`
}

func (s *Service) CreateOrder(customerID, establishmentID string, cartItems []CartItem) (*CreateOrderResult, error) {
	if len(cartItems) == 0 {
		return nil, fmt.Errorf("cart is empty")
	}

	var total float64
	var orderItems []OrderItem

	for _, ci := range cartItems {
		if ci.Quantity <= 0 {
			return nil, fmt.Errorf("invalid quantity for product %s", ci.ProductID)
		}

		product, err := s.CatalogRepo.GetProduct(ci.ProductID)
		if err != nil {
			return nil, fmt.Errorf("product %s not found", ci.ProductID)
		}
		if !product.IsAvailable {
			return nil, fmt.Errorf("product %s is not available", product.Name)
		}
		if product.EstablishmentID != establishmentID {
			return nil, fmt.Errorf("product %s does not belong to this establishment", product.Name)
		}

		subtotal := product.Price * float64(ci.Quantity)
		total += subtotal

		orderItems = append(orderItems, OrderItem{
			ProductID:   ci.ProductID,
			Quantity:    ci.Quantity,
			UnitPrice:   product.Price,
			Subtotal:    subtotal,
			ProductName: product.Name,
		})
	}

	idempotencyKey := uuid.New().String()
	order := &Order{
		EstablishmentID:       establishmentID,
		CustomerID:            customerID,
		Status:                "pending_payment",
		Total:                 total,
		PaymentIdempotencyKey: &idempotencyKey,
	}

	if err := s.OrderRepo.Create(order, orderItems); err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	pixResult, err := s.Payment.CreatePixCharge(order.ID, total, idempotencyKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create PIX charge: %w", err)
	}

	if err := s.OrderRepo.UpdatePaymentInfo(order.ID, pixResult.ChargeID, pixResult.PixQRCode, pixResult.PixExpiration); err != nil {
		return nil, fmt.Errorf("failed to update payment info: %w", err)
	}

	return &CreateOrderResult{
		Order:      order,
		Items:      orderItems,
		PixQRCode:  pixResult.PixQRCode,
		PixExpires: pixResult.PixExpiration.Format("2006-01-02T15:04:05Z"),
	}, nil
}
