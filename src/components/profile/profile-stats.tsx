import Link from "next/link";

interface ProfileStatsProps {
  username: string;
  postCount: number;
  totalLikes: number;
  followerCount: number;
  followingCount: number;
  simmrCount: number;
}

export function ProfileStats({
  username,
  postCount,
  totalLikes,
  followerCount,
  followingCount,
  simmrCount,
}: ProfileStatsProps) {
  return (
    <div className="flex items-center gap-5 text-sm flex-wrap justify-center">
      <div className="text-center">
        <p className="font-bold text-lg">{postCount}</p>
        <p className="text-muted-foreground">Posts</p>
      </div>
      <Link
        href={`/profile/${username}/followers`}
        className="text-center hover:opacity-70 transition-opacity"
      >
        <p className="font-bold text-lg">{followerCount}</p>
        <p className="text-muted-foreground">Followers</p>
      </Link>
      <Link
        href={`/profile/${username}/following`}
        className="text-center hover:opacity-70 transition-opacity"
      >
        <p className="font-bold text-lg">{followingCount}</p>
        <p className="text-muted-foreground">Following</p>
      </Link>
      <Link
        href={`/profile/${username}/simmrs`}
        className="text-center hover:opacity-70 transition-opacity"
      >
        <p className="font-bold text-lg">{simmrCount}</p>
        <p className="text-muted-foreground">Simmrs</p>
      </Link>
      <div className="text-center">
        <p className="font-bold text-lg">{totalLikes}</p>
        <p className="text-muted-foreground">Likes</p>
      </div>
    </div>
  );
}
