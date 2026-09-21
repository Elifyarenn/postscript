/**
 * Draws every stored team avatar again in today's style (D-216), so files
 * saved before a drawing change (D-215) catch up. Run it once after the
 * deploy that changed the drawings; it does exactly what a download of an
 * old record does, for every record:
 *
 *   pnpm redraw-team-avatars
 */
import { redrawAllTeamAvatarPngs } from "@/services/team-avatars";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const count = await redrawAllTeamAvatarPngs();
  console.log(`${count} avatar yeniden çizildi.`);
});