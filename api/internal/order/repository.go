package order

import (
	"time"

	"github.com/jmoiron/sqlx"
)

type Order struct {
	ID                   string     `db:"id" json:"id"`
	EstablishmentID      string     `db:"establishment_id" json:"establishment_id"`
	CustomerID           string     `db:"customer_id" json:"customer_id"`
	Status               string     `db:"status" json:"status"`
	Total                float64    `db:"total" json:"total"`
	PaymentProviderRef   *string    `db:"payment_provider_ref" json:"payment_provider_ref"`
	PaymentIdempotencyKey *string   `db:"payment_idempotency_key" json:"payment_idempotency_key"`
	PixQRCode            *string    `db:"pix_qr_code" json:"pix_qr_code,omitempty"`
	PixExpiration        *time.Time `db:"pix_expiration" json:"pix_expiration,omitempty"`
	CreatedAt            time.Time  `db:"created_at" json:"created_at"`
	PaidAt               *time.Time `db:"paid_at" json:"paid_at"`
	CollectedAt          *time.Time `db:"collected_at" json:"collected_at"`
}

type OrderItem struct {
	ID          string  `db:"id" json:"id"`
	OrderID     string  `db:"order_id" json:"order_id"`
	ProductID   string  `db:"product_id" json:"product_id"`
	Quantity    int     `db:"quantity" json:"quantity"`
	UnitPrice   float64 `db:"unit_price" json:"unit_price"`
	Subtotal    float64 `db:"subtotal" json:"subtotal"`
	ProductName string  `db:"product_name" json:"product_name"`
}

type OrderWithItems struct {
	Order
	Items []OrderItem `json:"items"`
}

type Repository struct {
	DB *sqlx.DB
}

func (r *Repository) Create(o *Order, items []OrderItem) error {
	tx, err := r.DB.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	err = tx.QueryRow(
		`INSERT INTO orders (establishment_id, customer_id, status, total, payment_idempotency_key)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
		o.EstablishmentID, o.CustomerID, o.Status, o.Total, o.PaymentIdempotencyKey,
	).Scan(&o.ID, &o.CreatedAt)
	if err != nil {
		return err
	}

	for i := range items {
		items[i].OrderID = o.ID
		err = tx.QueryRow(
			`INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, product_name)
			 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
			items[i].OrderID, items[i].ProductID, items[i].Quantity,
			items[i].UnitPrice, items[i].Subtotal, items[i].ProductName,
		).Scan(&items[i].ID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *Repository) GetByID(id string) (*OrderWithItems, error) {
	var o Order
	err := r.DB.Get(&o, "SELECT * FROM orders WHERE id = $1", id)
	if err != nil {
		return nil, err
	}

	var items []OrderItem
	err = r.DB.Select(&items, "SELECT * FROM order_items WHERE order_id = $1", id)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []OrderItem{}
	}

	return &OrderWithItems{Order: o, Items: items}, nil
}

func (r *Repository) ListByEstablishment(establishmentID string) ([]OrderWithItems, error) {
	var orders []Order
	err := r.DB.Select(&orders,
		"SELECT * FROM orders WHERE establishment_id = $1 ORDER BY created_at DESC", establishmentID)
	if err != nil {
		return nil, err
	}

	result := make([]OrderWithItems, len(orders))
	for i, o := range orders {
		var items []OrderItem
		r.DB.Select(&items, "SELECT * FROM order_items WHERE order_id = $1", o.ID)
		if items == nil {
			items = []OrderItem{}
		}
		result[i] = OrderWithItems{Order: o, Items: items}
	}
	return result, nil
}

func (r *Repository) ListByCustomer(customerID string) ([]OrderWithItems, error) {
	var orders []Order
	err := r.DB.Select(&orders,
		"SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC", customerID)
	if err != nil {
		return nil, err
	}

	result := make([]OrderWithItems, len(orders))
	for i, o := range orders {
		var items []OrderItem
		r.DB.Select(&items, "SELECT * FROM order_items WHERE order_id = $1", o.ID)
		if items == nil {
			items = []OrderItem{}
		}
		result[i] = OrderWithItems{Order: o, Items: items}
	}
	return result, nil
}

func (r *Repository) UpdatePaymentInfo(orderID, providerRef, pixQR string, pixExp time.Time) error {
	_, err := r.DB.Exec(
		`UPDATE orders SET payment_provider_ref=$1, pix_qr_code=$2, pix_expiration=$3 WHERE id=$4`,
		providerRef, pixQR, pixExp, orderID,
	)
	return err
}

func (r *Repository) MarkPaid(providerRef string) error {
	_, err := r.DB.Exec(
		`UPDATE orders SET status='paid', paid_at=NOW() WHERE payment_provider_ref=$1 AND status='pending_payment'`,
		providerRef,
	)
	return err
}

func (r *Repository) MarkPaidByID(orderID string) error {
	_, err := r.DB.Exec(
		`UPDATE orders SET status='paid', paid_at=NOW() WHERE id=$1 AND status='pending_payment'`,
		orderID,
	)
	return err
}

func (r *Repository) GetByProviderRef(providerRef string) (*Order, error) {
	var o Order
	err := r.DB.Get(&o, "SELECT * FROM orders WHERE payment_provider_ref=$1", providerRef)
	if err != nil {
		return nil, err
	}
	return &o, nil
}
