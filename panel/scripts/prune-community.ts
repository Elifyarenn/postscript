/**
 * Ends the retention periods the KVKK notice promises for the community
 * (D-088, D-090): traffic records, deleted or removed posts, comments and chat
 * messages, and closed content reports — each one year after it was written,
 * deleted or decided. Open reports are never touched.
 *
 * Suggested cron: once a day.
 */
import { pruneTrafficLogs } from "@/lib/traffic";
import { pruneDeletedCommunityContent } from "@/services/community";
import { pruneDeletedPosts } from "@/services/posts";
import { pruneResolvedReports } from "@/services/reports";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const now = new Date();
  const traffic = await pruneTrafficLogs(now);
  const deletedPosts = await pruneDeletedPosts(now);
  const community = await pruneDeletedCommunityContent(now);
  const reports = await pruneResolvedReports(now);

  console.log(
    `Pruned ${traffic} traffic record(s), ${deletedPosts} post(s), ${community.comments} comment(s), ` +
      `${community.messages} chat message(s) and ${reports} closed report(s).`,
  );
});
