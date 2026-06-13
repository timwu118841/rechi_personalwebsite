export async function POST(): Promise<Response> {
  return new Response('Use `npm run seed` from a trusted environment.', { status: 410 })
}
