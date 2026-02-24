import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function audit() {
  // 1. Find all users who have skills
  const usersWithSkills = await sql`
    SELECT DISTINCT us.user_id, u.username
    FROM user_skills us
    JOIN users u ON u.id = us.user_id
    ORDER BY u.username
  `;
  console.log(
    "Users with skills:",
    usersWithSkills.map((u) => u.username)
  );

  for (const user of usersWithSkills) {
    console.log("\n=== " + user.username + " ===");

    // 2. Get all their skills
    const userSkills = await sql`
      SELECT us.id as us_id, s.id as skill_id, s.name, s.tier, us.practice_count, us.mastered, us.post_id
      FROM user_skills us
      JOIN skills s ON s.id = us.skill_id
      WHERE us.user_id = ${user.user_id}
      ORDER BY s.name
    `;
    console.log("Skills (" + userSkills.length + "):");
    for (const s of userSkills) {
      console.log(
        "  - " + s.name + " (tier=" + s.tier + ", count=" + s.practice_count +
        ", mastered=" + s.mastered + ", post_id=" + (s.post_id || "NULL") + ")"
      );
    }

    // 3. Check for orphaned skills (post_id is null)
    const orphaned = userSkills.filter((s) => s.post_id === null);
    if (orphaned.length > 0) {
      console.log(
        "  *** ORPHANED SKILLS (post_id=null): " +
          orphaned.map((s) => s.name).join(", ")
      );
    }

    // 4. Check for skills pointing to non-existent posts
    const postIds = [
      ...new Set(
        userSkills.filter((s) => s.post_id).map((s) => s.post_id as string)
      ),
    ];
    if (postIds.length > 0) {
      const existingPosts = await sql`
        SELECT id, title, status, allocated_skill_ids FROM posts WHERE id = ANY(${postIds})
      `;
      const existingIdSet = new Set(existingPosts.map((p) => p.id));
      const missingPostIds = postIds.filter((id) => !existingIdSet.has(id));
      if (missingPostIds.length > 0) {
        const danglingSkills = userSkills.filter((s) =>
          missingPostIds.includes(s.post_id)
        );
        console.log(
          "  *** SKILLS POINTING TO DELETED POSTS: " +
            danglingSkills.map((s) => s.name + " -> " + s.post_id).join(", ")
        );
      }

      // 5. Check posts missing allocated_skill_ids backfill
      for (const post of existingPosts) {
        const skillsForPost = userSkills.filter((s) => s.post_id === post.id);
        const allocIds = post.allocated_skill_ids || [];
        if (allocIds.length === 0 && skillsForPost.length > 0) {
          console.log(
            '  *** POST MISSING allocated_skill_ids: "' +
              post.title + '" (id=' + post.id + ", status=" + post.status + ")"
          );
        }
      }

      // Print posts info
      console.log("  Posts with skills:");
      for (const post of existingPosts) {
        console.log(
          '    - "' + post.title + '" status=' + post.status +
          " allocated_skill_ids=" + JSON.stringify(post.allocated_skill_ids)
        );
      }
    }
  }
}

audit().catch((e) => {
  console.error(e);
  process.exit(1);
});
