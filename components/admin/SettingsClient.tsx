"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import { useToast } from "@/components/providers/ToastProvider";
import {
  setAttendanceSms,
  updateCenterName,
  updateAdminName,
  changePassword,
} from "@/app/[tenant]/admin/actions/settings";

export default function SettingsClient({
  centerName,
  adminName,
  attendanceSmsEnabled,
}: {
  centerName: string;
  adminName: string;
  attendanceSmsEnabled: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [enabled, setEnabled] = useState(attendanceSmsEnabled);
  const [smsPending, startSms] = useTransition();

  const [center, setCenter] = useState(centerName);
  const [name, setName] = useState(adminName);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next);
    startSms(async () => {
      const res = await setAttendanceSms(next);
      if (res.ok) toast.success("সেটিংস সংরক্ষিত হয়েছে।");
      else {
        setEnabled(!next);
        toast.error(res.error ?? "সমস্যা হয়েছে।");
      }
    });
  }

  function saveCenter() {
    start(async () => {
      const res = await updateCenterName(center);
      if (res.ok) {
        toast.success("সেন্টারের নাম আপডেট হয়েছে।");
        router.refresh();
      } else toast.error(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  function saveName() {
    start(async () => {
      const res = await updateAdminName(name);
      if (res.ok) toast.success("অ্যাডমিনের নাম আপডেট হয়েছে।");
      else toast.error(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  function savePassword() {
    start(async () => {
      const res = await changePassword(cur, pw);
      if (res.ok) {
        toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে।");
        setCur("");
        setPw("");
      } else toast.error(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  return (
    <Stack spacing={2}>
      {/* সেন্টারের নাম */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            সেন্টারের নাম
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <TextField label="সেন্টার" value={center} onChange={(e) => setCenter(e.target.value)} />
            <Button onClick={saveCenter} disabled={pending || !center.trim() || center === centerName}>
              সংরক্ষণ
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* অ্যাডমিনের নাম */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            অ্যাডমিনের নাম
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <TextField label="অ্যাডমিন" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={saveName} disabled={pending || !name.trim() || name === adminName}>
              সংরক্ষণ
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* পাসওয়ার্ড পরিবর্তন */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            পাসওয়ার্ড পরিবর্তন
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              label="বর্তমান পাসওয়ার্ড"
              type="password"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              autoComplete="current-password"
            />
            <TextField
              label="নতুন পাসওয়ার্ড"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              helperText="কমপক্ষে ৬ অক্ষর"
              autoComplete="new-password"
            />
            <Button
              onClick={savePassword}
              disabled={pending || !cur || pw.length < 6}
              sx={{ alignSelf: { sm: "flex-start" } }}
            >
              পাসওয়ার্ড পরিবর্তন করুন
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* উপস্থিতির SMS */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            উপস্থিতির SMS
          </Typography>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => toggle(e.target.checked)} disabled={smsPending} />}
            label="উপস্থিতির SMS চালু করুন"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            চালু থাকলে প্রতিদিন উপস্থিতি সংরক্ষণের সময় প্রতিটি শিক্ষার্থীকে SMS পাঠানো হবে।
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            অনেক শিক্ষার্থী থাকলে প্রতিদিন উপস্থিতির SMS খরচ অনেক বেড়ে যেতে পারে। তাই এটি
            ডিফল্টভাবে বন্ধ থাকে। পেমেন্টের SMS সবসময় চালু থাকে।
          </Alert>
        </CardContent>
      </Card>
    </Stack>
  );
}
