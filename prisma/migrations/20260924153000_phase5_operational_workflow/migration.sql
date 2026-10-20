-- AlterTable
ALTER TABLE "activities" ADD COLUMN "timetable_id" TEXT,
ADD COLUMN "actual_end_time" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "class_monitoring_alerts" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "timetable_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "alert_date" TIMESTAMP(3) NOT NULL,
    "expected_start_time" TEXT NOT NULL,
    "expected_end_time" TEXT NOT NULL,
    "rule_name" TEXT NOT NULL DEFAULT 'UNRECORDED_CLASS_ACTIVITY',
    "title" TEXT NOT NULL DEFAULT 'Scheduled class activity has not been recorded.',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "class_monitoring_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_monitoring_alerts_timetable_id_alert_date_key" ON "class_monitoring_alerts"("timetable_id", "alert_date");

-- CreateIndex
CREATE INDEX "class_monitoring_alerts_staff_id_idx" ON "class_monitoring_alerts"("staff_id");

-- CreateIndex
CREATE INDEX "class_monitoring_alerts_alert_date_idx" ON "class_monitoring_alerts"("alert_date");

-- CreateIndex
CREATE INDEX "class_monitoring_alerts_status_idx" ON "class_monitoring_alerts"("status");

-- CreateIndex
CREATE INDEX "activities_timetable_id_idx" ON "activities"("timetable_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_monitoring_alerts" ADD CONSTRAINT "class_monitoring_alerts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_monitoring_alerts" ADD CONSTRAINT "class_monitoring_alerts_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_monitoring_alerts" ADD CONSTRAINT "class_monitoring_alerts_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_monitoring_alerts" ADD CONSTRAINT "class_monitoring_alerts_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
