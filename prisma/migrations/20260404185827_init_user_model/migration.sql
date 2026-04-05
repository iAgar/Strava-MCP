-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "strava_athlete_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_strava_athlete_id_key" ON "User"("strava_athlete_id");
