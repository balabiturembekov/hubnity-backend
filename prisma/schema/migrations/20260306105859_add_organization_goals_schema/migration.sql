-- CreateTable
CREATE TABLE "organization_goals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subTitle" TEXT NOT NULL,
    "isPopular" BOOLEAN NOT NULL,

    CONSTRAINT "organization_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_goals_id_idx" ON "organization_goals"("id");
