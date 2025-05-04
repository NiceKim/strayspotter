import os
import torch
import torch.nn as nn
from torchvision import models, transforms
from torch.utils.data import DataLoader
from PIL import Image

# ⚙️ Device Settings
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# 🧠 Load Model
model = models.resnet18(pretrained=False)
model.fc = nn.Linear(model.fc.in_features, 6)  # 6 classes (car, dog, food, cat, person, text)
model.load_state_dict(torch.load('2025_04_30_trained_model.pth', map_location=device))
model = model.to(device)
model.eval()

# 📦 Image preprocessing
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# 🖼️ 1 image prediction function
def predict_image(image_path):
    img = Image.open(image_path).convert('RGB')
    img = transform(img)
    img = img.unsqueeze(0)
    img = img.to(device)

    with torch.no_grad():
        outputs = model(img)
        _, predicted = torch.max(outputs, 1)

    return predicted.item()

# 🐱 cat discrimination function
def is_cat(image_path):
    class_idx_to_name = {0: 'car', 1: 'cat', 2: 'dog', 3: 'food', 5: 'human',6: 'text'}
    pred = predict_image(image_path)
    predicted_class = class_idx_to_name[pred]

    if predicted_class == 'cat':
        print(f"🐱 '{os.path.basename(image_path)}' is cat!")
    else:
        print(f"❌ '{os.path.basename(image_path)}' is not cat! (Predict: {predicted_class})")

# 📂 All image check functions in the folder
def check_folder_for_cats(folder_path):
    images = os.listdir(folder_path)
    images = [img for img in images if img.lower().endswith(('.png', '.jpg', '.jpeg'))]

    for img_name in images:
        img_path = os.path.join(folder_path, img_name)
        print(f"🔍 검사 중: {img_name}")
        is_cat(img_path)

# 🚀 Execute
if __name__ == "__main__":
    folder_path = '/Users/kimdajin/Desktop/AI_Deeplearing_Projects/project4_2025_4_30/test_img_dic/텍스트'  # <<== Enter the folder path to be scanned here
    check_folder_for_cats(folder_path)
