package handler

import "github.com/miclle/niubility/internal/entity"

func sanitizePublicUser(user *entity.User) {
	if user == nil {
		return
	}

	user.Email = ""
	user.Mobile = ""
	user.DepartmentIDs = ""
}

func sanitizePublicUsers(users []entity.User) {
	for i := range users {
		sanitizePublicUser(&users[i])
	}
}

func sanitizePublicContent(content *entity.Content) {
	if content == nil {
		return
	}

	sanitizePublicUser(content.Author)
	sanitizePublicUser(content.Speaker)
}

func sanitizePublicContents(contents []entity.Content) {
	for i := range contents {
		sanitizePublicContent(&contents[i])
	}
}

func sanitizePublicComment(comment *entity.Comment) {
	if comment == nil {
		return
	}

	sanitizePublicUser(comment.User)
	sanitizePublicComment(comment.ReplyTo)
	for i := range comment.Replies {
		sanitizePublicComment(&comment.Replies[i])
	}
}

func sanitizePublicComments(comments []entity.Comment) {
	for i := range comments {
		sanitizePublicComment(&comments[i])
	}
}
