"use client"

import type React from "react"

import { Button } from "@/components/ui/button"

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  buttonText: string
  onButtonClick: () => void
  gradientFrom: string
  gradientTo: string
}

export default function FeatureCard({
  icon,
  title,
  description,
  buttonText,
  onButtonClick,
  gradientFrom,
  gradientTo,
}: FeatureCardProps) {
  return (
    <div className="group relative">
      <div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-cat-orange/10">
        <div className="relative mb-6">
          <div
            className={`w-20 h-20 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300`}
          >
            {icon}
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

        <h3 className="text-2xl font-bold text-cat-brown mb-4 text-center">{title}</h3>
        <p className="text-gray-600 text-center leading-relaxed mb-6">{description}</p>

        <div className="flex justify-center">
          <Button
            onClick={onButtonClick}
            className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white px-6 py-2 rounded-full hover:shadow-lg transition-all duration-300 hover:scale-105`}
          >
            {buttonText}
          </Button>
        </div>
      </div>
    </div>
  )
}
