package models

import "time"

type SenderType string

const (
	SenderUser SenderType = "USER"
	SenderAI   SenderType = "AI"
)

type Message struct {
	ID        string     `gorm:"column:id;type:uuid;primaryKey" json:"id"`
	SessionID string     `gorm:"column:sessionId;type:uuid;not null" json:"sessionId"`
	Session   Session    `gorm:"foreignKey:SessionID" json:"-"`
	Sender    SenderType `gorm:"column:sender;type:text;not null" json:"sender"`
	Content   string     `gorm:"column:content;not null" json:"content"`
	CreatedAt time.Time  `gorm:"column:createdAt" json:"createdAt"`
}

func (Message) TableName() string {
	return "Message"
}
