import FileUpload from './FileUpload'

// ImageUploadProps defines the configurable behavior of the ImageUpload component.
export interface ImageUploadProps {
  // Current image URL.
  value: string
  // Callback when image URL changes.
  onChange: (url: string) => void
  // Upload category, defaults to "covers".
  category?: 'covers' | 'images'
}

// ImageUpload is an image-specific upload component with preview display.
function ImageUpload({ value, onChange, category = 'covers' }: ImageUploadProps) {
  return (
    <FileUpload
      accept="image/*"
      category={category}
      value={value}
      onChange={onChange}
      placeholder="拖拽图片到此处或点击选择"
      renderPreview={(url) => (
        <img src={url} alt="preview" className="max-h-48 rounded object-contain mx-auto" />
      )}
    />
  )
}

export default ImageUpload
