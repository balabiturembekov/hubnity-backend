-- CreateTable
CREATE TABLE "_OrganizationToOrganizationGoal" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OrganizationToOrganizationGoal_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_OrganizationToOrganizationGoal_B_index" ON "_OrganizationToOrganizationGoal"("B");

-- AddForeignKey
ALTER TABLE "_OrganizationToOrganizationGoal" ADD CONSTRAINT "_OrganizationToOrganizationGoal_A_fkey" FOREIGN KEY ("A") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrganizationToOrganizationGoal" ADD CONSTRAINT "_OrganizationToOrganizationGoal_B_fkey" FOREIGN KEY ("B") REFERENCES "organization_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
