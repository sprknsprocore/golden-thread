# Solution Architecture: Production Management Prototype

The prototype architecture is centered on the **Production Event**—a triplet of {Resource + Output + Context}.

## 1. Core Data Structures (Mocked)
* **`Provisional_WBS_Code`:** A persistent placeholder for codes selected at the start of a work week.
* **`Claiming_Schema`:** A library of weighted sub-steps assigned to a cost code (e.g., "Cookbook" paint build-ups).
* **`Production_Event`:** Links labor hours to quantities and contextual variance notes.

## 2. Calculation Logic
* **Earned Hours:** `(Budgeted Hours * Claiming Schema % Complete)`
* **Performance Factor (PF):** `Earned Hours / Actual Hours`. A PF < 1.0 triggers a "Red Flag".
* **Reverse Calculation:** If a PM overrides the "Cost to Complete," the system back-calculates the required production rate.

## 3. Integrated LEM Pulse
Automatically trigger a material inventory drawdown when a production event is recorded (e.g., installing 30 cribs reduces on-site inventory).
