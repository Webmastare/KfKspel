import { createRouter, createWebHistory } from "vue-router";
import LandingPage from "@/pages/LandingPage.vue";
import Feedback from "@/pages/Feedback.vue";
import gameRouter from "./gamesRouter";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: LandingPage,
    },
    {
      path: "/feedback",
      name: "feedback",
      component: Feedback,
    },
    ...gameRouter,
  ],
});

export default router;
