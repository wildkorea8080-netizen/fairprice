const VERIFICATION_FILENAME = "naver942b392734709d81a7241ea8203108c3.html";

/**
 * Naver Search Advisor site ownership verification.
 *
 * The token is committed rather than read from an environment variable
 * because it is public by design - Naver verifies ownership by fetching this
 * exact URL, so anyone can read it. Keeping it in code means verification
 * cannot break because a variable failed to save, which is what happened
 * twice with the meta tag route.
 *
 * Naver expects the file to contain a single line naming itself.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(`naver-site-verification: ${VERIFICATION_FILENAME}`, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
