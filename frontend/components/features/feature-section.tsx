"use client"
import FeatureCard from "./feature-card"
import FeaturesCTA from "./feature-cta"
import FeaturesHeader from "./feature-header"
import { CameraIcon, GalleryIcon, ReportsIcon } from "./feature-icons"

interface FeaturesSectionProps {
  onUploadClick: () => void
}

export default function FeaturesSection({ onUploadClick }: FeaturesSectionProps) {
  const features = [
    {
      icon: <CameraIcon />,
      title: "Photo Sharing",
      description:
        "Easily upload and share photos of stray cats you encounter. Add location data and status information to help the community.",
      buttonText: "Share Photo",
      onButtonClick: onUploadClick,
      gradientFrom: "from-cat-orange",
      gradientTo: "to-primary",
    },
    {
      icon: <GalleryIcon />,
      title: "Gallery",
      description:
        "Browse through a beautiful collection of cat photos shared by the community. Filter by status and location.",
      buttonText: "View Gallery",
      onButtonClick: () => (window.location.href = "/gallery"),
      gradientFrom: "from-cat-brown",
      gradientTo: "to-cat-orange",
    },
    {
      icon: <ReportsIcon />,
      title: "Reports",
      description:
        "Access detailed analytics and reports about stray cat populations, trends, and community impact data.",
      buttonText: "View Reports",
      onButtonClick: () => (window.location.href = "/report"),
      gradientFrom: "from-primary",
      gradientTo: "to-cat-brown",
    },
  ]

  return (
    
      <div className="container mx-auto px-4">
        <FeaturesHeader />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              buttonText={feature.buttonText}
              onButtonClick={feature.onButtonClick}
              gradientFrom={feature.gradientFrom}
              gradientTo={feature.gradientTo}
            />
          ))}
        </div>

        <FeaturesCTA onUploadClick={onUploadClick} />
      </div>
   
  )
}
