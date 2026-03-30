package models

import "time"

type Session struct {
	ID         string    `gorm:"column:id;type:uuid;primaryKey" json:"id"`
	UserID     *string   `gorm:"column:userId;type:uuid" json:"userId"`
	User       *User     `gorm:"foreignKey:UserID" json:"-"`
	CrisisFlag bool      `gorm:"column:crisisFlag;default:false" json:"crisisFlag"`
	CreatedAt  time.Time `gorm:"column:createdAt" json:"createdAt"`
	Messages   []Message `gorm:"foreignKey:SessionID" json:"messages,omitempty"`
}

func (Session) TableName() string {
	return "Session"
}
