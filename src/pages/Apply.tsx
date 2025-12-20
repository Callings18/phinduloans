import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { ArrowLeft, ArrowRight, Upload, CheckCircle, User, Briefcase, CreditCard, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Employment", icon: Briefcase },
  { id: 3, title: "Loan Details", icon: CreditCard },
  { id: 4, title: "Documents", icon: FileText },
];

const Apply = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    // Personal Info
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nrc: "",
    dob: "",
    gender: "",
    address: "",
    
    // Employment
    employerName: "",
    employerAddress: "",
    jobTitle: "",
    employmentType: "",
    monthlyIncome: "",
    payDay: "",
    employmentDuration: "",
    
    // Loan Details
    loanAmount: 5000,
    loanPurpose: "",
    loanTerm: 6,
    repaymentMethod: "",
    
    // Documents
    nrcFront: null as File | null,
    nrcBack: null as File | null,
    payslip: null as File | null,
    selfie: null as File | null,
    
    // Consent
    termsAccepted: false,
    dataConsent: false,
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field: string, file: File | null) => {
    updateFormData(field, file);
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    toast({
      title: "Application Submitted!",
      description: "We'll review your application and get back to you within 24 hours.",
    });
  };

  const interestRate = 0.15;
  const monthlyPayment = (formData.loanAmount * (1 + interestRate * formData.loanTerm)) / formData.loanTerm;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Apply for a <span className="text-gradient">Loan</span>
            </h1>
            <p className="text-muted-foreground">
              Complete the form below to apply for your loan. It only takes a few minutes.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="max-w-3xl mx-auto mb-12">
            <div className="flex justify-between items-center">
              {steps.map((step, index) => (
                <div key={step.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center w-full">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        currentStep >= step.id
                          ? "gradient-primary shadow-glow"
                          : "bg-secondary border border-border"
                      }`}
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="text-primary-foreground" size={24} />
                      ) : (
                        <step.icon
                          className={currentStep >= step.id ? "text-primary-foreground" : "text-muted-foreground"}
                          size={24}
                        />
                      )}
                    </div>
                    <span
                      className={`mt-2 text-sm font-medium hidden md:block ${
                        currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 transition-colors duration-300 ${
                        currentStep > step.id ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="max-w-2xl mx-auto">
            <div className="glass rounded-3xl p-8 md:p-12">
              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Personal Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="Enter first name"
                        value={formData.firstName}
                        onChange={(e) => updateFormData("firstName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Enter last name"
                        value={formData.lastName}
                        onChange={(e) => updateFormData("lastName", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => updateFormData("email", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        placeholder="+260 XXX XXX XXX"
                        value={formData.phone}
                        onChange={(e) => updateFormData("phone", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="nrc">NRC Number</Label>
                      <Input
                        id="nrc"
                        placeholder="XXXXXX/XX/X"
                        value={formData.nrc}
                        onChange={(e) => updateFormData("nrc", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dob">Date of Birth</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={formData.dob}
                        onChange={(e) => updateFormData("dob", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select value={formData.gender} onValueChange={(v) => updateFormData("gender", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Residential Address</Label>
                      <Input
                        id="address"
                        placeholder="Enter your address"
                        value={formData.address}
                        onChange={(e) => updateFormData("address", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Employment */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Employment Details</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="employerName">Employer Name</Label>
                      <Input
                        id="employerName"
                        placeholder="Company name"
                        value={formData.employerName}
                        onChange={(e) => updateFormData("employerName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input
                        id="jobTitle"
                        placeholder="Your position"
                        value={formData.jobTitle}
                        onChange={(e) => updateFormData("jobTitle", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employerAddress">Employer Address</Label>
                    <Input
                      id="employerAddress"
                      placeholder="Company address"
                      value={formData.employerAddress}
                      onChange={(e) => updateFormData("employerAddress", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Employment Type</Label>
                      <Select value={formData.employmentType} onValueChange={(v) => updateFormData("employmentType", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="permanent">Permanent</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="self-employed">Self-Employed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Employment Duration</Label>
                      <Select value={formData.employmentDuration} onValueChange={(v) => updateFormData("employmentDuration", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="How long?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0-6">Less than 6 months</SelectItem>
                          <SelectItem value="6-12">6-12 months</SelectItem>
                          <SelectItem value="1-2">1-2 years</SelectItem>
                          <SelectItem value="2+">More than 2 years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="monthlyIncome">Monthly Income (ZMW)</Label>
                      <Input
                        id="monthlyIncome"
                        type="number"
                        placeholder="e.g. 5000"
                        value={formData.monthlyIncome}
                        onChange={(e) => updateFormData("monthlyIncome", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payDay">Pay Day</Label>
                      <Input
                        id="payDay"
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Day of month (1-31)"
                        value={formData.payDay}
                        onChange={(e) => updateFormData("payDay", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Loan Details */}
              {currentStep === 3 && (
                <div className="space-y-8 animate-fade-in">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Loan Details</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-4">
                        <Label>Loan Amount</Label>
                        <span className="text-primary font-bold text-xl">K{formData.loanAmount.toLocaleString()}</span>
                      </div>
                      <Slider
                        value={[formData.loanAmount]}
                        onValueChange={(value) => updateFormData("loanAmount", value[0])}
                        min={500}
                        max={50000}
                        step={500}
                      />
                      <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                        <span>K500</span>
                        <span>K50,000</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-4">
                        <Label>Loan Term</Label>
                        <span className="text-primary font-bold text-xl">{formData.loanTerm} months</span>
                      </div>
                      <Slider
                        value={[formData.loanTerm]}
                        onValueChange={(value) => updateFormData("loanTerm", value[0])}
                        min={1}
                        max={24}
                        step={1}
                      />
                      <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                        <span>1 month</span>
                        <span>24 months</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Purpose of Loan</Label>
                    <Select value={formData.loanPurpose} onValueChange={(v) => updateFormData("loanPurpose", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Why do you need this loan?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="home">Home Improvement</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Repayment Method</Label>
                    <Select value={formData.repaymentMethod} onValueChange={(v) => updateFormData("repaymentMethod", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="How will you repay?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile-money">Mobile Money</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="salary-deduction">Salary Deduction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Summary */}
                  <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Loan Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Loan Amount</span>
                        <span className="text-foreground font-medium">K{formData.loanAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Term</span>
                        <span className="text-foreground font-medium">{formData.loanTerm} months</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Interest Rate</span>
                        <span className="text-foreground font-medium">15% flat</span>
                      </div>
                      <div className="border-t border-border pt-3 flex justify-between">
                        <span className="text-foreground font-semibold">Monthly Payment</span>
                        <span className="text-primary font-bold text-xl">K{monthlyPayment.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Documents */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Upload Documents</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { field: "nrcFront", label: "NRC (Front)", description: "Clear photo of front" },
                      { field: "nrcBack", label: "NRC (Back)", description: "Clear photo of back" },
                      { field: "payslip", label: "Latest Payslip", description: "Most recent payslip" },
                      { field: "selfie", label: "Selfie", description: "Clear photo of your face" },
                    ].map((doc) => (
                      <div key={doc.field} className="space-y-2">
                        <Label>{doc.label}</Label>
                        <label
                          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                            formData[doc.field as keyof typeof formData]
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(doc.field, e.target.files?.[0] || null)}
                          />
                          {formData[doc.field as keyof typeof formData] ? (
                            <CheckCircle className="text-primary mb-2" size={32} />
                          ) : (
                            <Upload className="text-muted-foreground mb-2" size={32} />
                          )}
                          <span className="text-sm text-muted-foreground">{doc.description}</span>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 pt-6 border-t border-border">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="terms"
                        checked={formData.termsAccepted}
                        onCheckedChange={(checked) => updateFormData("termsAccepted", checked)}
                      />
                      <label htmlFor="terms" className="text-sm text-muted-foreground">
                        I agree to the{" "}
                        <a href="#" className="text-primary hover:underline">Terms and Conditions</a>{" "}
                        and{" "}
                        <a href="#" className="text-primary hover:underline">Loan Agreement</a>
                      </label>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="consent"
                        checked={formData.dataConsent}
                        onCheckedChange={(checked) => updateFormData("dataConsent", checked)}
                      />
                      <label htmlFor="consent" className="text-sm text-muted-foreground">
                        I consent to the processing of my personal data for loan assessment purposes
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-10 pt-6 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft size={20} />
                  Previous
                </Button>
                
                {currentStep < 4 ? (
                  <Button variant="hero" onClick={nextStep}>
                    Next Step
                    <ArrowRight size={20} />
                  </Button>
                ) : (
                  <Button
                    variant="hero"
                    onClick={handleSubmit}
                    disabled={!formData.termsAccepted || !formData.dataConsent}
                  >
                    Submit Application
                    <ArrowRight size={20} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Apply;
