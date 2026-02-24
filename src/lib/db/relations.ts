import { relations } from "drizzle-orm";
import {
  users,
  posts,
  likes,
  follows,
  skills,
  userSkills,
  recipeCorpus,
  cookingTipsCache,
  skillExtractionCache,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  likes: many(likes),
  followers: many(follows, { relationName: "following" }),
  following: many(follows, { relationName: "follower" }),
  userSkills: many(userSkills),
  corpusEntries: many(recipeCorpus),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  likes: many(likes),
  userSkills: many(userSkills),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [likes.postId],
    references: [posts.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  userSkills: many(userSkills),
}));

export const userSkillsRelations = relations(userSkills, ({ one }) => ({
  user: one(users, {
    fields: [userSkills.userId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [userSkills.skillId],
    references: [skills.id],
  }),
  post: one(posts, {
    fields: [userSkills.postId],
    references: [posts.id],
  }),
}));

export const recipeCorpusRelations = relations(recipeCorpus, ({ one }) => ({
  sourceUser: one(users, {
    fields: [recipeCorpus.sourceUserId],
    references: [users.id],
  }),
}));

export const cookingTipsCacheRelations = relations(cookingTipsCache, () => ({}));

export const skillExtractionCacheRelations = relations(skillExtractionCache, () => ({}));
