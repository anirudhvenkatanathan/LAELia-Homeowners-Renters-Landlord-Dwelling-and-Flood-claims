import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import App from './App';
import ErrorBoundary from './components/layout/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';

// Import skin CSS — provides all design tokens and base classes
import '@skin/css/main.css';
import '@skin/css/custom.css';
import '@skin/css/ag-grid-custom.css';

const client = new ApolloClient({
  uri: (import.meta as any).env.VITE_GRAPHQL_URL,
  cache: new InMemoryCache(),
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element with id="root" not found in the document.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </ApolloProvider>
  </React.StrictMode>
);
