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
  corpusAnalytics,
  mealPlans,
  shoppingLists,
  collections,
  collectionItems,
  userBadges,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  likes: many(likes),
  followers: many(follows, { relationName: "following" }),
  following: many(follows, { relationName: "follower" }),
  userSkills: many(userSkills),
  corpusEntries: many(recipeCorpus),
  mealPlans: many(mealPlans),
  shoppingLists: many(shoppingLists),
  collections: many(collections),
  badges: many(userBadges),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  likes: many(likes),
  userSkills: many(userSkills),
  collectionItems: many(collectionItems),
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

export const corpusAnalyticsRelations = relations(corpusAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [corpusAnalytics.userId],
    references: [users.id],
  }),
}));

export const mealPlansRelations = relations(mealPlans, ({ one }) => ({
  user: one(users, {
    fields: [mealPlans.userId],
    references: [users.id],
  }),
}));

export const shoppingListsRelations = relations(shoppingLists, ({ one }) => ({
  user: one(users, {
    fields: [shoppingLists.userId],
    references: [users.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, {
    fields: [collections.userId],
    references: [users.id],
  }),
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
  post: one(posts, {
    fields: [collectionItems.postId],
    references: [posts.id],
  }),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.id],
  }),
}));
