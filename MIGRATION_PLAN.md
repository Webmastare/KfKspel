# KfKbandvagn Migration Plan: Vanilla JS → Vue 3 + TypeScript + Supabase Edge Functions

## Overview

This document outlines the step-by-step migration of the KfKbandvagn game from vanilla JavaScript to a modern Vue 3 + TypeScript implementation using Supabase Edge Functions for the backend.

## Goals

- **Simplicity**: Keep implementation straightforward, prefer fewer files over complex abstractions
- **Type Safety**: Use TypeScript for better development experience
- **Reactivity**: Leverage Vue's reactivity for state management
- **Performance**: Use Supabase Edge Functions for better API performance
- **Maintainability**: Cleaner code structure without over-engineering

---

## Phase 1: Project Setup & Type Definitions ✅ COMPLETED

### Step 1: TypeScript Configuration ✅

- [x] Update `tsconfig.json` to include strict mode and game-specific types
- [x] Configure Vite for proper TypeScript handling
- [x] Add ESLint rules for TypeScript

### Step 2: Create Core Type Definitions and Type Guards ✅

Create scripts (composables) for each aspect of the game that has the interfaces and type guards for that part of the game. Also note that we can continue using the same supabase client as the one already created in `src/utils/supabase.ts`.

Create `src/composables/kfkbandvagn/player.ts`:

- [x] Define Player interface (uuid, playerID, position, lives, tokens, range, color)

Create `src/composables/kfkbandvagn/gameActions.ts`

- [x] Define GameAction types (move, shot, range, life)
- [x] Add position validation and range calculation utilities

Create `src/composables/kfkbandvagn/board.ts`:

- [x] Define GameBoard interface (size, shrink, logs)
- [x] Define GameLog interface (playerID, action, timestamp, moveDirection, targetUUID)
- [x] Add board shrinking logic and validation

Create `src/composables/kfkbandvagn/apiHandler.ts`:

- [x] Define API response types
- [x] Add error response interfaces
- [x] Define request payload types for all actions

Create `src/composables/kfkbandvagn/animations.ts`:

- [x] Define the animation related types (Explosion, Bullet)
- [x] Merge the scripts such that all rgb to hsl functions are here
- [x] Add particle system types and animation states

Create `src/composables/kfkbandvagn/useCanvas.ts`:

- [x] Define Canvas-related types (e.g. Cell, Popup, Zoom, Pan)
- [x] Add coordinate transformation types
- [x] Define drawing context interfaces

Create `src/composables/kfkbandvagn/imageProcessor.ts`:

- [x] Web Worker and image processing with types similar to original worker.js
- [x] Add image caching and preloading types

### Step 3: Database Schema Review

- [x] Review existing Supabase tables and ensure they match new TypeScript interfaces
- [x] Add missing database indexes for performance
- [x] Document database relationships and constraints

---

## Phase 2: Supabase Edge Functions

### Step 4: Database Setup and Security

- [x] Review and update Row Level Security (RLS) policies
- [x] Users will interact with the Edge Functions and the edge functions use the service role key
- [x] All updates will be validated in the Edge Functions
- [x] Create backup and recovery procedures

### Step 5: Create Edge Functions Structure

```
supabase/functions/
├── _shared/
│   ├── auth.ts
│   └── validation.ts
│
└── kfkbandvagn/
    ├── board-handler.ts
    ├── game-state.ts
    ├── game-actions.ts
    ├── auth-handler.ts
    └── admin-tools.ts
```

### Step 6: Migrate API Endpoints to Edge Functions

#### `board-handler`

- [x] A new function that should be called from a cronjob in supabase
- [x] Handles shrinking of board and token distribution to players
- [x] Two endpoints one that shrinks the board and one that gives all players one new token
- [x] Implement a way to determine how much to shrink based on the size of the board and then a new column in the table that holds the value for the next shrinking. Shrink once a day.

#### `game-state`

- [x] Replace `/getKfKbandvagn` endpoint
- [x] Handle player data and board data fetching from the two tables
- [x] Add proper TypeScript types for responses
- [x] Implement caching for better performance

#### `game-actions`

- [x] Replace `/doActionKfKbandvagn` endpoint
- [x] Handle move, shot, range, and life actions
- [x] Add server-side validation for all actions
- [x] Implement proper error handling

#### `auth-handlers`

- [x] Replace `/loginKfKbandvagn` and `/createKfKbandvagn` endpoints
- [x] Handle authentication and player creation
- [x] Use supabase auth together with the game
- [x] Login is handled by the auth but authenticed users need to create a player
- [x] Add proper user session management somewhat handled by JWTs but include refreshing of board and player data.

#### `admin-tools`

- [x] Admin-only functions for game management
- [x] Board reset functionality
- [x] Player management and moderation tools
- [x] Game statistics and analytics endpoints
- [x] Bulk operations for testing and maintenance

### Step 7: Shared Utilities

Create `supabase/functions/_shared/`:

- [x] `auth.ts` - JWT validation and user authentication
- [x] `validation.ts` - Input validation functions and schemas
- [x] `types.ts` - Shared TypeScript types between client and server

### Step 8: Rate Limiting and Security

- [ ] Implement rate limiting for all game actions
- [ ] Add request validation and sanitization
- [ ] Implement proper error logging and monitoring
- [ ] Create audit trails for all game actions

---

## Phase 3: Vue Component Architecture

### Step 9: Create Main Game Component

Create `src/pages/Kfkbandvagn.vue` as the main game container:

- [ ] Set up basic template structure
- [ ] Import and use child components
- [ ] Handle routing and navigation
- [ ] Manage overall game state
- [ ] Add proper loading states and error boundaries

### Step 10: Canvas Component (`src/components/BandvagnCanvas.vue`)

Convert the canvas rendering logic:

- [ ] Create reactive canvas setup with proper TypeScript types
- [ ] Implement `useCanvas` composable for canvas operations
- [ ] Handle zoom, pan, and touch interactions
- [ ] Maintain the existing drawing logic but with proper typing
- [ ] Keep the Web Worker for image processing
- [ ] Add canvas accessibility features
- [ ] Implement proper cleanup for canvas resources

```vue
<template>
  <div class="canvas-container">
    <canvas ref="canvasRef" @wheel="handleZoom" @mousedown="startPan" />
    <GamePopup v-if="selectedCell" :cell="selectedCell" :player="selectedPlayer" />
  </div>
</template>
```

### Step 11: Authentication Components

Create simple auth components:

- [ ] `PlayerCreation.vue` - Handle bandvagn creation, user needs to have a KfKspel account
- [ ] Reuse the existing scss for forms used by the Auth.vue component
- [ ] Add form validation and error handling
- [ ] Implement loading states for auth operations

### Step 12: Game UI Components

- [ ] `GamePopup.vue` - Replace the DOM manipulation popup with Vue component
- [ ] `PlayerInfo.vue` - Display current player stats (lives, tokens, range)
- [ ] `GameLogs.vue` - Display game action logs with proper scrolling
- [ ] `GameControls.vue` - Movement buttons and action controls
- [ ] `GameRules.vue` - Convert the rules section to a proper component
- [ ] `PlayerUpgrades.vue` - Handle upgrade purchases and display
- [ ] `GameMessages.vue` - Handle game messages and notifications

---

## Phase 4: State Management & Composables

### Step 13: Game State Store (`src/stores/bandvagnState.ts`)

Create a centralized game state store with Pinia:

- [ ] States such as players, gameBoard, currentPlayer, selectedCell and gameLogs are stored locally for quick access
- [ ] Keep a timestamp of when the last fetch was done and automatically update if too old
- [ ] All fetching is done to the edge functions
- [ ] Handle KfKbandvagn Authentication which is linked to normal supabase auth
- [ ] Add proper error state management
- [ ] Implement optimistic updates for better UX
- [ ] Add state persistence for offline scenarios
- [ ] Create state validation and type guards

### Step 14: Canvas Composable (`src/composables/kfkbandvagn/useCanvas.ts`)

Extract canvas logic:

- [ ] Handle canvas setup and resizing
- [ ] Manage zoom and pan state
- [ ] Provide drawing utilities
- [ ] Handle coordinate transformations
- [ ] Add canvas event handling
- [ ] Implement proper cleanup and memory management
- [ ] Add performance monitoring for canvas operations

### Step 15: API Composable (`src/composables/kfkbandvagn/useAPI.ts`)

Replace fetch calls with typed API functions:

- [ ] `getGameState()` - Fetch players and board data
- [ ] `performAction(action)` - Execute game actions
- [ ] `authenticateUser(credentials)` - Handle login
- [ ] `createPlayer(playerData)` - Create new player
- [ ] Add proper error handling and loading states
- [ ] Implement retry logic for failed requests
- [ ] Add request caching and deduplication
- [ ] Handle network status and offline scenarios

### Step 16: Game Logic Composables

Add to the already created composables for game logic:

- [ ] `player.ts` - Manage player movement and collision detection
- [ ] `board.ts` - Manage board state and game logs
- [ ] `gameActions.ts` - Handle game action validation and execution
- [ ] `animations.ts` - Handle explosions, bullets, and other animations
- [ ] `apiHandler.ts` - Functions to interact with the Edge Functions
- [ ] `useCanvas.ts` - Review and Implement the canvas logic
- [ ] `imageProcessor.ts` - Update and review the webworker for image processing

---

## Phase 5: Game Logic Migration

### Step 17: Canvas Rendering System

Migrate the drawing functionality while keeping it simple:

- [ ] Convert `draw()` function to use reactive state
- [ ] Keep the existing grid, player, and range drawing logic
- [ ] Maintain the animation system (explosions, bullets)
- [ ] Update coordinate calculation for Vue reactivity
- [ ] Add proper error handling for canvas operations
- [ ] Implement canvas performance optimization

### Step 18: Game Interaction System

- [ ] Convert `handleCellClick` to use Vue events and reactive state
- [ ] Update player movement logic with proper TypeScript types
- [ ] Maintain the popup system but as Vue components
- [ ] Keep the range calculation and validation logic
- [ ] Add keyboard shortcuts and accessibility features
- [ ] Implement proper event cleanup

### Step 19: Animation System Migration

- [ ] Convert animation classes to TypeScript with proper typing
- [ ] Maintain Web Worker for image processing
- [ ] Update color conversion functions (RGB to HSL)
- [ ] Add animation performance monitoring
- [ ] Implement proper cleanup for animation resources

### Step 20: Real-time Updates Implementation

- [ ] Replace polling with Supabase real-time subscriptions
- [ ] Listen for game state changes from other players
- [ ] Update UI reactively when other players take actions
- [ ] Handle connection drops and reconnection
- [ ] Add conflict resolution for simultaneous actions
- [ ] Implement proper cleanup for subscriptions

---

## Phase 6: Error Handling & Polish

### Step 21: Error Management

- [ ] Create centralized error handling system
- [ ] Add proper TypeScript error types
- [ ] Implement user-friendly error messages (not just alerts - clean UI!)
- [ ] Add loading states for all async operations
- [ ] Implement error recovery mechanisms
- [ ] Add error reporting and logging
- [ ] Create fallback states for failed operations

### Step 22: Mobile Support & Accessibility

- [ ] Ensure touch events work properly in Vue
- [ ] Test zoom and pan on mobile devices (Works in original, should work as is)
- [ ] Adjust UI for mobile screens and different screen sizes
- [ ] Keep the existing touch interaction logic
- [ ] Add proper ARIA labels and accessibility features
- [ ] Implement keyboard navigation for all game functions
- [ ] Add screen reader support
- [ ] Test with accessibility tools

### Step 23: Performance Optimization

- [ ] Implement proper Vue reactivity patterns
- [ ] Optimize canvas rendering with Vue lifecycle hooks
- [ ] Add proper cleanup for Web Workers and timers
- [ ] Ensure no memory leaks in the game loop
- [ ] Implement lazy loading for non-critical components
- [ ] Add performance monitoring and metrics
- [ ] Optimize bundle size and loading times
- [ ] Implement service worker for offline functionality

### Step 24: Internationalization (Future Enhancement)

- [ ] Prepare application structure for multiple languages
- [ ] Extract all text strings to translation files
- [ ] Add language selection component
- [ ] Implement date/time formatting for different locales

---

## Phase 7: Testing & Deployment

### Step 25: Comprehensive Testing

- [ ] Test authentication flows (login, logout, player creation)
- [ ] Test all game actions (move, shoot, upgrade, range increase)
- [ ] Test canvas interactions on different devices and browsers
- [ ] Verify Edge Functions work properly under load
- [ ] Test real-time updates and synchronization
- [ ] Test error scenarios and recovery mechanisms
- [ ] Perform cross-browser compatibility testing
- [ ] Test mobile responsiveness and touch interactions
- [ ] Validate security and rate limiting
- [ ] Test offline functionality and reconnection

### Step 26: Admin Tools and Management

- [ ] A new Edge function for board and player data reset
- [ ] Admin dashboard for game monitoring
- [ ] Player management tools (ban, unban, modify stats)
- [ ] Game statistics and analytics
- [ ] Backup and restore functionality
- [ ] Ensure admin functions are properly secured

### Step 27: Deployment Setup

- [ ] Configure Supabase Edge Functions deployment
- [ ] Update Vue app build configuration for production
- [ ] Set up environment-specific configurations
- [ ] Test production environment thoroughly
- [ ] Update CORS settings for Edge Functions
- [ ] Configure CDN and caching strategies
- [ ] Set up monitoring and alerting
- [ ] Create deployment automation scripts

### Step 28: Documentation and Maintenance

- [ ] Create API documentation for Edge Functions
- [ ] Document component architecture and usage
- [ ] Create developer setup and contribution guide
- [ ] Document deployment and maintenance procedures
- [ ] Create troubleshooting guide
- [ ] Set up automated backups and disaster recovery

---

## Implementation Notes

### Keep It Simple Principles

1. **Single File Components**: Keep related logic in the same Vue file when reasonable
2. **Minimal Abstractions**: Don't over-engineer the state management
3. **Direct API Calls**: Use simple async/await instead of complex API layers
4. **Inline Styles**: Use Vue's style bindings for dynamic styles instead of complex CSS systems
5. **Pragmatic TypeScript**: Use `any` when type safety isn't critical for development speed

### Migration Order

1. Start with TypeScript setup and basic Vue structure
2. Migrate Edge Functions first to ensure backend stability
3. Convert canvas component while maintaining existing logic
4. Add authentication and game state management
5. Implement remaining UI components
6. Polish and optimize

### Estimated Timeline

- **Phase 1**: 2-3 days (Setup + Type Definitions + Database Review)
- **Phase 2**: 4-5 days (Edge Functions + Security + Database Setup)
- **Phase 3**: 3-4 days (Vue Components + UI Components)
- **Phase 4**: 3-4 days (State Management + Composables)
- **Phase 5**: 3-4 days (Game Logic Migration + Real-time Updates)
- **Phase 6**: 2-3 days (Error Handling + Performance + Accessibility)
- **Phase 7**: 2-3 days (Testing + Admin Tools + Deployment)

**Total**: ~19-26 days depending on complexity, testing requirements, and feature completeness

### Risk Mitigation

- **Complex Canvas Logic**: Keep original drawing logic intact, only wrap in Vue reactivity
- **Real-time Synchronization**: Implement comprehensive conflict resolution and fallback to polling
- **Performance Issues**: Monitor canvas performance and implement proper cleanup
- **Authentication Edge Cases**: Thoroughly test all auth flows and edge cases
- **Database Migration**: Create rollback procedures for any schema changes

This plan maintains the core game functionality while modernizing the codebase with TypeScript safety, Vue reactivity, better API architecture through Supabase Edge Functions, and improved user experience.

---

## Future Enhancements (Post-Migration)

### Advanced Features

- **Spectator Mode**: Allow users to watch games without participating
- **Replay System**: Record and replay game sessions
- **Tournament Mode**: Organize structured competitions
- **Team Play**: Allow players to form alliances and teams
- **Advanced Analytics**: Detailed player statistics and game insights
- **Custom Game Modes**: Different rule sets and game variants
- **Chat System**: In-game communication between players
- **Achievement System**: Badges and rewards for game milestones

### Technical Improvements

- **Progressive Web App (PWA)**: Full offline support and app-like experience
- **WebRTC Integration**: Peer-to-peer real-time updates for better performance
- **Advanced Caching**: Implement sophisticated caching strategies
- **Microservices**: Split Edge Functions into smaller, specialized services
- **GraphQL API**: Consider GraphQL for more efficient data fetching
- **AI Players**: Computer-controlled players for single-player mode

### Quality of Life

- **Dark Mode**: Theme switching capabilities
- **Customizable UI**: User-configurable interface elements
- **Sound Effects**: Audio feedback for game actions
- **Visual Effects**: Enhanced animations and particle effects
- **Tutorial System**: Interactive onboarding for new players
- **Game History**: Persistent game history and statistics
