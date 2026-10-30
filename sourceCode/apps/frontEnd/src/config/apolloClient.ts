import { ApolloClient, InMemoryCache } from '@apollo/client';

let clientInstance: ApolloClient<object> | null = null;

/**
 * Returns the shared ApolloClient singleton.
 * Outside of React components, use this instead of useApolloClient().
 */
export function getApolloClient(): ApolloClient<object> {
  if (!clientInstance) {
    clientInstance = new ApolloClient({
      uri: (import.meta as any).env.VITE_GRAPHQL_URL,
      cache: new InMemoryCache(),
    });
  }
  return clientInstance;
}
