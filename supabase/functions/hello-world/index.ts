// Test function to verify Functions setup
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

console.log("Hello from Functions!");

Deno.serve((_req) => {
  return new Response("Hello World!!", { status: 200 });
});
