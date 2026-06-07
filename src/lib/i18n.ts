import type { AppLanguage } from "@/lib/preferences";

type CopyKey =
  | "leaderboards"
  | "topPlayers"
  | "settings"
  | "volume"
  | "brightness"
  | "soundEffects"
  | "aboutTheGame"
  | "aboutText"
  | "researchersProfile"
  | "language"
  | "fontSize"
  | "highContrast"
  | "darkMode"
  | "defaultSize"
  | "largeSize"
  | "extraLargeSize"
  | "helpInfo"
  | "howToUse"
  | "gameMechanics"
  | "loginGuide"
  | "statusSettingsSaved"
  | "rewardCenter"
  | "growthTracker"
  | "backToMap"
  | "completedLevels"
  | "avgBestScore"
  | "recentMilestones"
  | "rewardsSummary"
  | "latestCompletedLevels"
  | "noCompletedLevels"
  | "levelLesson"
  | "lessonComingSoon"
  | "levelActivities"
  | "levelLessonCardTitle"
  | "levelActivityCardEmptyTitle"
  | "activityModalClose"
  | "activityModalNoHtml"
  | "activityModalOpenList"
  | "activityModalOpenNewTab"
  | "requiredMissions"
  | "completeRequiredActivities"
  | "noPublishedActivities"
  | "backToLevel"
  | "returnToMap"
  | "openPptResource"
  | "geometryFocus"
  | "lrn"
  | "enterLrn"
  | "saveLrn"
  | "lrnSaved"
  | "lrnAlreadyTaken";

const COPY: Record<AppLanguage, Record<CopyKey, string>> = {
  English: {
    leaderboards: "LEADERBOARDS",
    topPlayers: "Top 1-10 Players",
    settings: "SETTINGS",
    volume: "Volume",
    brightness: "Brightness",
    soundEffects: "Sound Effects",
    aboutTheGame: "About the Game",
    aboutText: "SolveAd is a game-inspired thesis platform where students complete map levels and activities.",
    researchersProfile: "Researchers' Profile",
    language: "Language",
    fontSize: "Font Size",
    highContrast: "High Contrast",
    darkMode: "Dark Mode",
    defaultSize: "Default",
    largeSize: "Large",
    extraLargeSize: "Extra Large",
    helpInfo: "Help & Info",
    howToUse: "How to use the app",
    gameMechanics: "Game mechanics",
    loginGuide: "Login guide",
    statusSettingsSaved: "Settings saved.",
    rewardCenter: "Reward Center",
    growthTracker: "Your Growth Tracker",
    backToMap: "Back to Map",
    completedLevels: "Completed Levels",
    avgBestScore: "Avg Best Score",
    recentMilestones: "Recent Milestones",
    rewardsSummary: "Rewards Summary",
    latestCompletedLevels: "Latest Completed Levels",
    noCompletedLevels: "No completed levels yet. Finish activities to unlock milestones.",
    levelLesson: "Lesson",
    lessonComingSoon: "Lesson coming soon",
    levelActivities: "Activities",
    levelLessonCardTitle: "Review & Learn",
    levelActivityCardEmptyTitle: "Start Activities",
    activityModalClose: "Close",
    activityModalNoHtml: "This activity does not have an HTML file yet.",
    activityModalOpenList: "Open activity list",
    activityModalOpenNewTab: "Open in new tab",
    requiredMissions: "Required Missions",
    completeRequiredActivities: "Complete all required activities to unlock the next level.",
    noPublishedActivities: "No published activities yet for this level.",
    backToLevel: "Back to Level",
    returnToMap: "Return to Map",
    openPptResource: "Open PPT Resource",
    geometryFocus: "Geometry Focus",
    lrn: "LRN (Learner Reference Number)",
    enterLrn: "Enter your LRN",
    saveLrn: "Save LRN",
    lrnSaved: "LRN saved.",
    lrnAlreadyTaken: "That LRN is already used by another account.",
  },
  Filipino: {
    leaderboards: "LEADERBOARDS",
    topPlayers: "Nangungunang 1-10 na Manlalaro",
    settings: "SETTINGS",
    volume: "Lakas ng Tunog",
    brightness: "Liwanag",
    soundEffects: "Sound Effects",
    aboutTheGame: "Tungkol sa Laro",
    aboutText: "Ang SolveAd ay isang game-inspired na thesis platform kung saan kinukumpleto ng mga estudyante ang mga level at aktibidad sa mapa.",
    researchersProfile: "Profile ng mga Researcher",
    language: "Wika",
    fontSize: "Laki ng Font",
    highContrast: "Mataas na Contrast",
    darkMode: "Dark Mode",
    defaultSize: "Default",
    largeSize: "Malaki",
    extraLargeSize: "Sobrang Laki",
    helpInfo: "Tulong at Impormasyon",
    howToUse: "Paano gamitin ang app",
    gameMechanics: "Mekaniks ng laro",
    loginGuide: "Gabay sa pag-login",
    statusSettingsSaved: "Na-save ang settings.",
    rewardCenter: "Sentro ng Gantimpala",
    growthTracker: "Iyong Growth Tracker",
    backToMap: "Bumalik sa Mapa",
    completedLevels: "Nakumpletong Levels",
    avgBestScore: "Average na Pinakamataas na Iskor",
    recentMilestones: "Pinakabagong Milestones",
    rewardsSummary: "Buod ng Gantimpala",
    latestCompletedLevels: "Pinakahuling Nakumpletong Levels",
    noCompletedLevels: "Wala pang nakumpletong level. Tapusin ang activities para makakuha ng milestones.",
    levelLesson: "Aralin",
    lessonComingSoon: "Paparating pa lang ang aralin",
    levelActivities: "Mga Aktibidad",
    levelLessonCardTitle: "Balikan at Matuto",
    levelActivityCardEmptyTitle: "Simulan ang Mga Aktibidad",
    activityModalClose: "Isara",
    activityModalNoHtml: "Wala pang HTML file ang aktibidad na ito.",
    activityModalOpenList: "Buksan ang listahan ng aktibidad",
    activityModalOpenNewTab: "Buksan sa bagong tab",
    requiredMissions: "Mga Kailangang Mission",
    completeRequiredActivities: "Tapusin ang lahat ng kailangang aktibidad para ma-unlock ang susunod na level.",
    noPublishedActivities: "Wala pang na-publish na activities para sa level na ito.",
    backToLevel: "Bumalik sa Level",
    returnToMap: "Bumalik sa Mapa",
    openPptResource: "Buksan ang PPT Resource",
    geometryFocus: "Pokos sa Geometry",
    lrn: "LRN (Learner Reference Number)",
    enterLrn: "Ilagay ang iyong LRN",
    saveLrn: "I-save ang LRN",
    lrnSaved: "Na-save ang LRN.",
    lrnAlreadyTaken: "Ang LRN na iyon ay ginagamit na ng ibang account.",
  },
};

export function getCopy(language: AppLanguage): Record<CopyKey, string> {
  return COPY[language] ?? COPY.English;
}
