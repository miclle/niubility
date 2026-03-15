package entity

import "time"

// Department represents a department synced from WeChat Work.
type Department struct {
	ID        int64     `json:"id"         gorm:"column:id;primaryKey"`
	Name      string    `json:"name"       gorm:"column:name"`
	NameEn    string    `json:"name_en"    gorm:"column:name_en"`
	ParentID  int64     `json:"parent_id"  gorm:"column:parent_id"`
	Order     uint32    `json:"order"      gorm:"column:order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName specifies the database table name for Department.
func (Department) TableName() string {
	return "departments"
}
