import FileUpload from './FileUpload'

// ImageUploadProps defines the configurable behavior of the ImageUpload component.
export interface ImageUploadProps {
  // Current image URL.
  value: string
  // Callback when image URL changes.
  onChange: (url: string) => void
  // Placeholder text shown in the upload area.
  placeholder?: string
}

// ImageUpload is an image-specific upload component with preview display.
function ImageUpload({ value, onChange, placeholder = 'Drag image here or click to select' }: ImageUploadProps) {
  return (
    <FileUpload
      accept="image/*"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      renderPreview={(url) => (
        <img src={url} alt="preview" className="max-h-48 rounded object-contain mx-auto" />
      )}
    />
  )
}

export default ImageUpload
