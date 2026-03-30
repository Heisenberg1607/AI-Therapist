package models

import "time"

type User struct {
	ID        string    `gorm:"column:id;type:uuid;primaryKey" json:"id"`
	Email     string    `gorm:"column:email;uniqueIndex;not null" json:"email"`
	Password  string    `gorm:"column:password;not null" json:"-"`
	Name      *string   `gorm:"column:name" json:"name"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`
	Sessions  []Session `gorm:"foreignKey:UserID" json:"-"`
}

func (User) TableName() string {
	return "User"
}
