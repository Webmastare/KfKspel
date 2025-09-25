import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from "vue-router";
import LandingPage from "@/pages/LandingPage.vue";
import gameRouter from "./gamesRouter";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: LandingPage,
    },
    ...gameRouter,
  ],
});

export default router;
