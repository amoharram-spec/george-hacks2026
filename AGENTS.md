<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Codex README

## App Overview

This app turns lab reports, bloodwork data, and meal images into a structured nutrition plan with detailed macro and micronutrient tracking.

Users can:

- upload lab reports and bloodwork data
- receive a nutrition plan based on those results
- follow a rough meal plan with guidance on how to stick to it
- upload images of meals for AI-based food analysis
- get estimated macro and micronutrient breakdowns from meal images
- export meal and nutrition data into a clean document to share with a doctor or nutritionist

## Core Features

### 1. Lab Report and Bloodwork Processing
Users upload bloodwork or lab report data, and the app processes it to help generate a personalized nutrition plan.

This plan is intended to organize nutritional insights around:

- macronutrients
  - protein
  - carbohydrates
  - fats
- micronutrients
  - vitamins
  - minerals
  - other relevant nutrient markers

### 2. Personalized Nutrition Plan
After processing bloodwork and lab data, the app creates a nutrition-focused plan that helps the user understand what to eat and how to maintain consistency.

The app also includes:

- a rough meal plan
- suggested food choices
- guidance on adhering to the meal plan
- nutritional targeting based on user health data

### 3. Meal Image Upload and AI Food Analysis
Users can upload images of their meals.

The app uses AI image processing to:

- identify foods in the image
- estimate serving composition
- calculate macros
- estimate key micronutrients

This gives users an easy way to log meals without entering everything manually.

### 4. Exportable Nutrition Reports
Users can export their nutrition and meal data into a clean document that can be shared with:

- doctors
- nutritionists
- dietitians
- health professionals

The exported document should be simple, organized, and professional.

## Tech Stack

- **Frontend:** Next.js
- **AI Image Processing:** Gemini
- **Backend / Database / Auth / Storage:** not configured yet

## Suggested Product Goals

This app should aim to be:

- simple to use
- visually clean
- medically organized
- useful for both everyday users and health professionals

## Example User Flow

1. User signs in
2. User uploads bloodwork or lab report data
3. App generates a nutrition plan based on those results
4. User receives a rough meal plan and guidance
5. User uploads meal photos daily
6. Gemini processes the images and estimates food nutrients
7. App stores meal history and nutritional data in the app's future backend
8. User exports a report for their doctor or nutritionist

## Potential Features to Build

- authentication and user profiles
- lab report upload and parsing
- dashboard for nutrient tracking
- meal image upload
- AI food recognition with Gemini
- macro and micronutrient summaries
- export to PDF or printable report
- doctor-ready report formatting
- meal adherence tracking
- reminders and progress logs

## Folder / Build Context

This app is built with:

- **Next.js** for the application frontend and app structure
- **Gemini** for meal image analysis and nutrient estimation
- Backend services are not wired up yet; current flows should use local placeholders where needed

## Important Notes

- Nutritional guidance should be presented as informational support, not as a replacement for professional medical advice.
- Bloodwork interpretation should be handled carefully and clearly framed for review by licensed professionals.
- Exported reports should stay structured, readable, and easy to review.

## Short Description

A Next.js nutrition app that processes lab reports, bloodwork, and meal images to generate personalized nutrition plans, estimate macro and micronutrient intake, and export clean health-ready reports for doctors or nutritionists.
