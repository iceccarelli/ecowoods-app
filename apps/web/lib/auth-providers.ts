/**
 * 설정된 OAuth 프로바이더 목록을 반환.
 * 서버 컴포넌트에서 호출해 어떤 소셜 로그인 버튼을 보여줄지 결정합니다.
 *
 * Returns the list of OAuth providers that have credentials configured
 * in environment variables — used by Server Components to decide which
 * social login buttons to render.
 */

export type OAuthProvider = 'google' | 'facebook' | 'twitter';

export function getEnabledProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (process.env.AUTH_GOOGLE_ID)   providers.push('google');
  if (process.env.AUTH_FACEBOOK_ID) providers.push('facebook');
  if (process.env.AUTH_TWITTER_ID)  providers.push('twitter');
  return providers;
}
