import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/services/database";
import { faceEmbeddingExtractor } from "@/services/faceEmbeddingExtractor";
import { Voter } from "@/types";
import { VoterImageCapture } from "./VoterImageCapture";

export const VoterManagement = () => {
  const [name, setName] = useState("");
  const [voterId, setVoterId] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const slots = db.getSlots();

  const handleImageCapture = (file: File) => {
    setImageFile(file);
  };

  const handleClearImage = () => {
    setImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !voterId || !selectedSlot || !imageFile) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields and upload an image",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Extract face embedding from the uploaded image
      const faceEmbedding = await faceEmbeddingExtractor.extractEmbeddingFromFile(imageFile);
      
      if (!faceEmbedding) {
        toast({
          title: "No face detected",
          description: "Could not detect a face in the uploaded image. Please upload a clear photo showing your face.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Create a temporary URL for display purposes
      const imageUrl = URL.createObjectURL(imageFile);

      const newVoter: Voter = {
        id: `voter_${Date.now()}`,
        name,
        voterId,
        slotId: selectedSlot,
        imageUrl,
        voted: false,
        faceEmbedding: faceEmbeddingExtractor.convertToStorageFormat(faceEmbedding)
      };

      db.addVoter(newVoter);

      toast({
        title: "Success",
        description: "Voter has been added successfully with face verification enabled",
      });

      setName("");
      setVoterId("");
      setSelectedSlot("");
      setImageFile(null);
    } catch (error) {
      console.error("Error adding voter:", error);
      toast({
        title: "Error",
        description: "Failed to process voter image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Voter</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Voter Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter voter name"
            />
          </div>
          
          <div>
            <Label htmlFor="voterId">Voter ID</Label>
            <Input
              id="voterId"
              value={voterId}
              onChange={(e) => setVoterId(e.target.value)}
              placeholder="Enter voter ID"
            />
          </div>
          
          <div>
            <Label htmlFor="slot">Slot</Label>
            <Select value={selectedSlot} onValueChange={setSelectedSlot}>
              <SelectTrigger>
                <SelectValue placeholder="Select a slot" />
              </SelectTrigger>
              <SelectContent>
                {slots.map((slot) => (
                  <SelectItem key={slot.id} value={slot.id}>
                    {slot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <VoterImageCapture
            onImageCapture={handleImageCapture}
            currentImage={imageFile}
            onClearImage={handleClearImage}
          />
          
          <Button type="submit" disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Add Voter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};